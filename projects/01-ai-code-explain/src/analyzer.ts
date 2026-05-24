import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";

export interface AnalysisResult {
  summary: string;
  dependencies: string[];
  components: string[];
  risks: string[];
}

function getClient(): Anthropic {
  const apiKey =
    process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || "";

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

  let parsed: AnalysisResult;
  try {
    // 尝试从可能包含 markdown 代码块的输出中提取 JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`无法解析模型返回的 JSON:\n${raw.slice(0, 500)}`);
  }

  const normalizeArray = (arr: unknown): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) =>
      typeof item === "string" ? item : JSON.stringify(item),
    );
  };

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    dependencies: normalizeArray(parsed.dependencies),
    components: normalizeArray(parsed.components),
    risks: normalizeArray(parsed.risks),
  };
}
