import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { parseAnalysisResult, type AnalysisResult } from "./analysis-result.js";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";

  const opts: Record<string, unknown> = { apiKey };

  if (process.env.OPENAI_BASE_URL) {
    opts.baseURL = process.env.OPENAI_BASE_URL;
  }

  return new Anthropic(opts as any);
}

export async function analyzeFile(filePath: string): Promise<AnalysisResult> {
  const absolutePath = resolve(filePath);
  let fileContent: string;

  try {
    fileContent = readFileSync(absolutePath, "utf-8");
  } catch (err: any) {
    throw new Error(`无法读取文件 ${filePath}: ${err.message}`);
  }

  if (!fileContent.trim()) {
    throw new Error(`文件 ${filePath} 内容为空`);
  }

  const client = getClient();
  const modelName = process.env.MODEL_NAME || "official-deepseek-v4-pro";

  const userPrompt = buildUserPrompt({ filePath, fileContent });

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
