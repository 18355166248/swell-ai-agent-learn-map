import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 优先加载根 .env 中的 OPENAI_API_KEY，项目级 .env 不覆盖已设置的值
config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

/** OpenRouter 默认地址 */
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** 默认 Embedding 模型（OpenRouter 免费可用，1536 维） */
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Embedding 向量 */
export type Embedding = number[];

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Doc RAG",
    },
  } as any);
}

/**
 * 将单条文本转换为向量。
 * 返回的向量维度取决于模型（text-embedding-3-small 为 1536 维）。
 */
export async function getEmbedding(text: string, model?: string): Promise<Embedding> {
  const client = getClient();
  const embeddingModel = model || process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  const response = await client.embeddings.create({
    model: embeddingModel,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * 批量将多条文本转换为向量。
 * 一次 API 调用处理全部输入，减少网络开销。
 */
export async function getEmbeddings(texts: string[], model?: string): Promise<Embedding[]> {
  const client = getClient();
  const embeddingModel = model || process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  const response = await client.embeddings.create({
    model: embeddingModel,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

// Day 1 验证：打印一段文字的向量前 10 维
async function main() {
  const sampleText =
    "Embedding（嵌入）是一种将文本转换为高维数字向量的技术。语义相近的文本，其向量在空间中距离也更近。";

  console.log(`模型: ${process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL}`);
  console.log(`输入文本: ${sampleText}\n`);

  try {
    const embedding = await getEmbedding(sampleText);
    console.log(`向量维度: ${embedding.length}`);
    console.log(
      `前 10 维: [${embedding
        .slice(0, 10)
        .map((v) => v.toFixed(6))
        .join(", ")}]`,
    );
    console.log(
      `后 10 维: [${embedding
        .slice(-10)
        .map((v) => v.toFixed(6))
        .join(", ")}]`,
    );
  } catch (err: any) {
    console.error(`Embedding 请求失败: ${err.message}`);
    process.exit(1);
  }
}

// 直接运行时执行验证
const isDirectRun =
  process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^\.\//, ""));
if (isDirectRun) {
  main();
}
