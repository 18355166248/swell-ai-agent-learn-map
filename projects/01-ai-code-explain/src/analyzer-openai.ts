import OpenAI, { APIError } from "openai";
import { readFileSync } from "fs";
import { resolve } from "path";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import { parseAnalysisResult, type AnalysisResult } from "./analysis-result.js";

const STATUS_TIPS: Record<number, string> = {
  401: "API Key 无效，请检查 .env.openai 中的 OPENAI_API_KEY",
  402: "该免费模型已停止提供或额度用尽，试试其他模型",
  403: "访问被拒绝，请检查 OpenRouter 账户状态",
  429: "请求太频繁或免费额度用完了，稍等几分钟再试或换个模型",
};

export interface AnalyzeFileOptions {
  onChunk?: (chunk: string) => void;
}

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

export async function analyzeFile(
  filePath: string,
  options: AnalyzeFileOptions = {},
): Promise<AnalysisResult> {
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
  const modelName = process.env.MODEL_NAME || "openai/gpt-oss-120b:free";

  const userPrompt = buildUserPrompt({ filePath, fileContent });

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
