import OpenAI, { APIError } from "openai";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildDirectorySummaryPrompt, SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { parseAnalysisResult, type AnalysisResult } from "./analysis-result.js";
import type { DirectoryFileResult } from "./types.js";

/** HTTP 状态码对应的中文提示 */
const STATUS_TIPS: Record<number, string> = {
  401: "API Key 无效，请检查 .env.openai 中的 OPENAI_API_KEY",
  402: "该免费模型已停止提供或额度用尽，试试其他模型",
  403: "访问被拒绝，请检查 OpenRouter 账户状态",
  429: "请求太频繁或免费额度用完了，稍等几分钟再试或换个模型",
};

/** 分析选项 */
export interface AnalyzeFileOptions {
  /** 流式输出的增量回调，用于实时打印模型输出 */
  onChunk?: (chunk: string) => void;
}

/** 创建 OpenAI SDK 客户端（兼容 OpenRouter），设置必要的请求头 */
function getClient(): OpenAI {
  const config: Record<string, string> = {
    apiKey: process.env.OPENAI_API_KEY || "",
  };

  if (process.env.OPENAI_BASE_URL) {
    config.baseURL = process.env.OPENAI_BASE_URL;
  }

  return new OpenAI({
    ...config,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "AI Code Explain",
    },
  } as any);
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
  const modelName = process.env.MODEL_NAME || "openai/gpt-oss-120b:free";

  const userPrompt = buildUserPrompt({ filePath, fileContent, question });

  let raw = "";
  try {
    if (options.onChunk) {
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

      // streaming 只负责把模型增量内容透出给 CLI；最终仍然要以完整 JSON 做统一解析。
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (!delta) continue;
        raw += delta;
        options.onChunk(delta);
      }
    } else {
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
    }
  } catch (err) {
    if (err instanceof APIError) {
      const tip = STATUS_TIPS[err.status] || "";
      throw new Error(`${modelName}: ${err.status} ${err.message}${tip ? `\n${tip}` : ""}`);
    }
    throw err;
  }

  if (!raw) {
    throw new Error("模型返回了空内容");
  }

  return parseAnalysisResult(raw);
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
  const modelName = process.env.MODEL_NAME || "openai/gpt-oss-120b:free";
  const userPrompt = buildDirectorySummaryPrompt({ dirPath, files, question });

  let raw = "";

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: "你是一个前端目录分析助手。请只返回简洁中文总结。" },
        { role: "user", content: userPrompt },
      ],
    });

    raw = response.choices[0]?.message?.content?.trim() || "";
  } catch (err) {
    if (err instanceof APIError) {
      const tip = STATUS_TIPS[err.status] || "";
      throw new Error(`${modelName}: ${err.status} ${err.message}${tip ? `\n${tip}` : ""}`);
    }
    throw err;
  }

  if (!raw) {
    throw new Error("模型返回了空内容");
  }

  return raw;
}
