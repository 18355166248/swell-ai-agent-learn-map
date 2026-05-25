import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildDirectorySummaryPrompt, SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { parseAnalysisResult, type AnalysisResult } from "./analysis-result.js";
import type { DirectoryFileResult } from "./types.js";

/** 创建 Anthropic SDK 客户端，支持通过 OPENAI_BASE_URL 切换兼容端点 */
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";

  const opts: Record<string, unknown> = { apiKey };

  if (process.env.OPENAI_BASE_URL) {
    opts.baseURL = process.env.OPENAI_BASE_URL;
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
  const modelName = process.env.MODEL_NAME || "official-deepseek-v4-pro";

  const userPrompt = buildUserPrompt({ filePath, fileContent, question });

  const response = await client.messages.create({
    model: modelName,
    max_tokens: 2048,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // 提取 text 类型的 content block（跳过 thinking 等类型）
  const textBlocks = response.content.filter((b) => b.type === "text");
  const raw = textBlocks.map((b) => (b as any).text).join("");
  if (!raw) {
    throw new Error("模型返回了空内容");
  }

  return parseAnalysisResult(raw);
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
  const modelName = process.env.MODEL_NAME || "official-deepseek-v4-pro";
  const userPrompt = buildDirectorySummaryPrompt({ dirPath, files, question });

  const response = await client.messages.create({
    model: modelName,
    max_tokens: 600,
    temperature: 0.2,
    system: "你是一个前端目录分析助手。请只返回简洁中文总结。",
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  const raw = textBlocks.map((b) => (b as any).text).join("").trim();

  if (!raw) {
    throw new Error("模型返回了空内容");
  }

  return raw;
}
