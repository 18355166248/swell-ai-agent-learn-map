import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

function resolveModelName(explicitModel?: string): string {
  const model = explicitModel || process.env.ANTHROPIC_MODEL_NAME;
  if (!model) {
    throw new Error("未设置 ANTHROPIC_MODEL_NAME 环境变量");
  }
  return model;
}

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    baseURL: process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Doc RAG",
    },
  } as any);
}

const REWRITE_PROMPT = `你是一个搜索查询优化器。将用户问题扩展为 3-5 个检索关键词。

规则：
- 只输出 3-5 个关键词或短语，用中文逗号分隔
- 不要超过 40 个字
- 关键词应来自文档中可能出现的术语，不要编造通用词
- 保留原始问题中的核心词

示例：
用户: 图片怎么上传？
输出: 图片上传, 前端压缩, OSS临时凭证, CDN回源

用户: 登录过期了怎么办？
输出: access_token过期, refresh_token续期, JWT认证`;

/**
 * 将用户简短问题改写为检索友好的扩展查询。
 * 返回改写后的查询字符串，失败时回退到原始问题。
 */
export async function rewriteQuery(question: string, model?: string): Promise<string> {
  const client = getClient();
  const modelName = resolveModelName(model);

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      temperature: 0.1,
      max_tokens: 150,
      messages: [
        { role: "system", content: REWRITE_PROMPT },
        { role: "user", content: question },
      ],
    });

    const rewritten = response.choices[0]?.message?.content?.trim() || "";
    return rewritten || question;
  } catch (err: any) {
    console.error(`Query 改写失败: ${err.message}，回退到原始问题`);
    return question;
  }
}
