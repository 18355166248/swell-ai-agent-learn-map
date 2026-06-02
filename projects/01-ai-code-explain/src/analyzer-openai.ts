import OpenAI, { APIError } from "openai";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildDirectorySummaryPromptFromText, SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { detectResultLanguage, isLanguageMatch, resolveOutputLanguage } from "./output-language.js";
import {
  hasMeaningfulAnalysisResult,
  parseAnalysisResult,
  type AnalysisResult,
} from "./analysis-result.js";
import type { DirectoryFileResult } from "./types.js";
import { truncateContent } from "./content-truncator.js";
import { extractContextLimitFromError, isContextTooLongError, withRetry } from "./retry.js";

/** HTTP 状态码对应的中文提示 */
const STATUS_TIPS: Record<number, string> = {
  401: "API Key 无效，请检查 .env.openai 中的 OPENAI_API_KEY",
  402: "该免费模型已停止提供或额度用尽，试试其他模型",
  403: "访问被拒绝，请检查 OpenRouter 账户状态",
  429: "请求太频繁或免费额度用完了，稍等几分钟再试或换个模型",
  404: "请求地址或模型名不存在；请确认当前走的是 OpenRouter 地址，并使用受支持的免费模型",
};

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** 分析选项 */
export interface AnalyzeFileOptions {
  /** 流式输出的增量回调，用于实时打印模型输出 */
  onChunk?: (chunk: string) => void;
}

/** 创建 OpenAI SDK 客户端（兼容 OpenRouter），设置必要的请求头 */
function getClient(): OpenAI {
  const config: Record<string, string> = {
    apiKey: process.env.OPENAI_API_KEY || "",
    // OpenAI CLI 默认面向 OpenRouter 免费模型，未显式配置时直接使用 OpenRouter 地址，
    // 避免模型 ID 落到 OpenAI 官方地址后出现稳定 404。
    baseURL: process.env.OPENAI_BASE_URL || DEFAULT_OPENROUTER_BASE_URL,
  };

  return new OpenAI({
    ...config,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "AI Code Explain",
    },
  } as any);
}

/** 将 API 错误转换为带中文提示的友好错误 */
function wrapApiError(err: unknown, modelName: string): Error {
  if (err instanceof APIError) {
    const tip = STATUS_TIPS[err.status] || "";
    return new Error(`${modelName}: ${err.status} ${err.message}${tip ? `\n${tip}` : ""}`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function analyzeContent(
  filePath: string,
  fileContent: string,
  question?: string,
  options: AnalyzeFileOptions = {},
): Promise<AnalysisResult> {
  if (!fileContent.trim()) {
    throw new Error(`文件 ${filePath} 内容为空`);
  }

  const client = getClient();
  const modelName = process.env.OPENAI_MODEL_NAME || "openai/gpt-oss-120b:free";
  const outputLanguage = resolveOutputLanguage(question);

  const buildUserPromptWithBudget = (content: string, forceNonEmptySummary = false) => {
    const basePrompt = buildUserPrompt({
      filePath,
      fileContent: content,
      question,
      outputLanguage,
    });
    if (!forceNonEmptySummary) {
      return basePrompt;
    }

    return (
      `${basePrompt}\n\n` +
      (outputLanguage === "en"
        ? "Additional requirement: summary must contain at least one full English sentence and cannot be empty; if dependencies/components/risks are empty, summary must still clearly explain the file's primary responsibility."
        : "补充要求：summary 必须是至少一句中文，不能留空；如果 dependencies/components/risks 判断为空，也必须先在 summary 里明确说明这个文件的主要职责。")
    );
  };
  const createTruncation = (safetyMargin: number, forceNonEmptySummary = false) =>
    truncateContent(fileContent, filePath, {
      modelName,
      systemPrompt: SYSTEM_PROMPT,
      createPrompt: (content: string) => buildUserPromptWithBudget(content, forceNonEmptySummary),
      maxOutputTokens: 2048,
      safetyMargin,
    });

  let truncResult = createTruncation(1000);
  if (truncResult.truncated) {
    process.stderr.write(`${truncResult.warning}\n`);
  }

  const runRequest = async (
    content: string,
    forceNonEmptySummary = false,
    extraInstruction = "",
  ) => {
    const basePrompt = buildUserPromptWithBudget(content, forceNonEmptySummary);
    const userPrompt = basePrompt + extraInstruction;
    let raw = "";

    if (options.onChunk) {
      await withRetry(async () => {
        raw = ""; // 每次重试前清空，避免 stream 中途报错时将半截 JSON 拼入下一次重试结果
        const stream = await client.chat.completions.create({
          model: modelName,
          temperature: 0.2,
          max_tokens: 2048,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          stream: true,
        });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;
          raw += delta;
          options.onChunk!(delta);
        }
      }, `OpenAI streaming ${filePath}`);
    } else {
      await withRetry(async () => {
        raw = ""; // 重试前清空，streaming 下尤其重要：防止半截 JSON 拼入下一次结果
        const response = await client.chat.completions.create({
          model: modelName,
          temperature: 0.2,
          max_tokens: 2048,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
        });

        raw = response.choices[0]?.message?.content || "";
      }, `OpenAI ${filePath}`);
    }

    return raw;
  };

  let raw = "";

  try {
    raw = await runRequest(truncResult.content);
  } catch (err) {
    if (!isContextTooLongError(err)) {
      throw wrapApiError(err, modelName);
    }

    // 上下文仍然超限时，不原样重试请求，而是进一步缩小输入后重新发起一次。
    const serverLimit = extractContextLimitFromError(err);
    const fallbackResult = truncateContent(fileContent, filePath, {
      modelName,
      contextLimit: serverLimit,
      systemPrompt: SYSTEM_PROMPT,
      createPrompt: (content: string) => buildUserPromptWithBudget(content),
      maxOutputTokens: 2048,
      safetyMargin: 4000,
    });
    if (fallbackResult.truncated && fallbackResult.content !== truncResult.content) {
      process.stderr.write(
        `[上下文兜底] ${filePath}: 首次压缩后仍超限，继续按服务端真实限制缩小输入重试${serverLimit ? `（${serverLimit} tokens）` : ""}\n`,
      );
      process.stderr.write(`${fallbackResult.warning}\n`);
      truncResult = fallbackResult;

      try {
        raw = await runRequest(truncResult.content);
      } catch (retryErr) {
        throw wrapApiError(retryErr, modelName);
      }
    } else {
      throw wrapApiError(err, modelName);
    }
  }

  if (!raw) {
    throw new Error("模型返回了空内容");
  }

  let parsed = parseAnalysisResult(raw);
  if (hasMeaningfulAnalysisResult(parsed)) {
    // 结果语言校验：检查 summary + dependencies + components + risks 全部文本字段
    let resultLanguage = detectResultLanguage(parsed);
    if (!isLanguageMatch(resultLanguage, outputLanguage)) {
      process.stderr.write(
        `[语言兜底] ${filePath}: 期望 ${outputLanguage}，实际 ${resultLanguage || "未知"}，追加强制语言指令重试\n`,
      );
      const langHint =
        outputLanguage === "zh-CN"
          ? "\n\n【强制要求】你的上一次回复没有使用中文。summary、dependencies、components、risks 的值必须全部使用中文。禁止使用英文。"
          : "\n\n【MANDATORY】Your last reply did not use English. All values in summary, dependencies, components, risks MUST be in English. Do NOT use Chinese.";
      raw = await runRequest(truncResult.content, false, langHint);
      parsed = parseAnalysisResult(raw);

      // 重试后再次校验：若仍不匹配，记录警告但不无限重试
      if (hasMeaningfulAnalysisResult(parsed)) {
        resultLanguage = detectResultLanguage(parsed);
        if (!isLanguageMatch(resultLanguage, outputLanguage)) {
          process.stderr.write(
            `[语言兜底] ${filePath}: 强制重试后语言仍未纠正（${resultLanguage || "未知"}），已尽力\n`,
          );
        }
      }
    }
    return parsed;
  }

  process.stderr.write(`[结果兜底] ${filePath}: 模型返回了全空 JSON，使用更强约束重试一次\n`);
  const stricterTruncation = createTruncation(1500, true);
  if (stricterTruncation.truncated && stricterTruncation.content !== truncResult.content) {
    process.stderr.write(`${stricterTruncation.warning}\n`);
  }

  const strictRaw = await runRequest(stricterTruncation.content, true);
  parsed = parseAnalysisResult(strictRaw);

  // 兜底路径也做语言校验，避免绕过前面的语言约束
  if (hasMeaningfulAnalysisResult(parsed)) {
    const resultLanguage = detectResultLanguage(parsed);
    if (!isLanguageMatch(resultLanguage, outputLanguage)) {
      process.stderr.write(
        `[语言兜底] ${filePath}: 期望 ${outputLanguage}，实际 ${resultLanguage || "未知"}，已尽力（兜底路径无法再重试）\n`,
      );
    }
  }
  return parsed;
}

export async function analyzeFile(
  filePath: string,
  question?: string,
  options: AnalyzeFileOptions = {},
): Promise<AnalysisResult> {
  const absolutePath = resolve(filePath);
  let fileContent: string;

  try {
    fileContent = readFileSync(absolutePath, "utf-8");
  } catch (err: any) {
    throw new Error(`无法读取文件 ${filePath}: ${err.message}`);
  }

  return analyzeContent(filePath, fileContent, question, options);
}

export async function summarizeDirectory(
  dirPath: string,
  files: DirectoryFileResult[],
  question?: string,
): Promise<string> {
  const client = getClient();
  const modelName = process.env.OPENAI_MODEL_NAME || "openai/gpt-oss-120b:free";
  const outputLanguage = resolveOutputLanguage(question);
  const summarySystemPrompt =
    outputLanguage === "en"
      ? "You are a frontend directory analysis assistant. Return only a concise English summary."
      : "你是一个前端目录分析助手。请只返回简洁中文总结。";
  const directorySummaryText = JSON.stringify(files, null, 2);
  const buildDirectoryPrompt = (content: string) =>
    buildDirectorySummaryPromptFromText(dirPath, content, question, outputLanguage);
  const truncResult = truncateContent(directorySummaryText, dirPath, {
    modelName,
    systemPrompt: summarySystemPrompt,
    createPrompt: buildDirectoryPrompt,
    maxOutputTokens: 600,
    safetyMargin: 800,
  });
  if (truncResult.truncated) {
    process.stderr.write(`${truncResult.warning}\n`);
  }

  const userPrompt = buildDirectoryPrompt(truncResult.content);
  let raw = "";

  try {
    await withRetry(async () => {
      const response = await client.chat.completions.create({
        model: modelName,
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          { role: "system", content: summarySystemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      raw = response.choices[0]?.message?.content?.trim() || "";
    }, `OpenAI 目录总结 ${dirPath}`);
  } catch (err) {
    throw wrapApiError(err, modelName);
  }

  if (!raw) {
    throw new Error("模型返回了空内容");
  }

  return raw;
}
