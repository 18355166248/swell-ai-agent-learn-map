import Anthropic from "@anthropic-ai/sdk";
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

/** 解析 Anthropic CLI 使用的 base URL。只读专用变量，避免和 OpenAI CLI 互相影响。 */
export function resolveAnthropicBaseURL(env: NodeJS.ProcessEnv): string | undefined {
  return env.ANTHROPIC_BASE_URL;
}

/** 创建 Anthropic SDK 客户端，支持通过 ANTHROPIC_BASE_URL 切换兼容端点 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";

  const opts: Record<string, unknown> = { apiKey };
  const baseURL = resolveAnthropicBaseURL(process.env);
  if (baseURL) {
    opts.baseURL = baseURL;
  }

  return new Anthropic(opts as any);
}

export async function analyzeContent(
  filePath: string,
  fileContent: string,
  question?: string,
): Promise<AnalysisResult> {
  if (!fileContent.trim()) {
    throw new Error(`文件 ${filePath} 内容为空`);
  }

  const client = getClient();
  const modelName = process.env.ANTHROPIC_MODEL_NAME || "official-deepseek-v4-pro";
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

    await withRetry(async () => {
      const response = await client.messages.create({
        model: modelName,
        max_tokens: 2048,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const textBlocks = response.content.filter((b) => b.type === "text");
      raw = textBlocks.map((b) => (b as any).text).join("");
    }, `Anthropic ${filePath}`);

    return raw;
  };

  let raw = "";

  try {
    raw = await runRequest(truncResult.content);
  } catch (err: any) {
    if (!isContextTooLongError(err)) {
      throw new Error(`${modelName}: ${err.message || err}`);
    }

    // Anthropic/OpenAI 兼容端点都可能在服务端再计算协议开销，这里做一次更激进的压缩兜底。
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
      } catch (retryErr: any) {
        throw new Error(`${modelName}: ${retryErr.message || retryErr}`);
      }
    } else {
      throw new Error(`${modelName}: ${err.message || err}`);
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

export async function analyzeFile(filePath: string, question?: string): Promise<AnalysisResult> {
  const absolutePath = resolve(filePath);
  let fileContent: string;

  try {
    fileContent = readFileSync(absolutePath, "utf-8");
  } catch (err: any) {
    throw new Error(`无法读取文件 ${filePath}: ${err.message}`);
  }

  return analyzeContent(filePath, fileContent, question);
}

export async function summarizeDirectory(
  dirPath: string,
  files: DirectoryFileResult[],
  question?: string,
): Promise<string> {
  const client = getClient();
  const modelName = process.env.ANTHROPIC_MODEL_NAME || "official-deepseek-v4-pro";
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
      const response = await client.messages.create({
        model: modelName,
        max_tokens: 600,
        temperature: 0.2,
        system: summarySystemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const textBlocks = response.content.filter((b) => b.type === "text");
      raw = textBlocks
        .map((b) => (b as any).text)
        .join("")
        .trim();
    }, `Anthropic 目录总结 ${dirPath}`);
  } catch (err: any) {
    throw new Error(`${modelName}: ${err.message || err}`);
  }

  if (!raw) {
    throw new Error("模型返回了空内容");
  }

  return raw;
}
