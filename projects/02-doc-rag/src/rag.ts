import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { getEmbedding } from "./embedder.js";
import { retrieve, type VectorEntry } from "./retriever.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";
const TOP_K = 3;

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

/** RAG 问答结果 */
export interface RagAnswer {
  answer: string;
  sources: {
    file: string;
    index: number;
    excerpt: string;
    similarity: number;
  }[];
}

function buildPrompt(question: string, chunks: string[]): string {
  const context = chunks.map((c, i) => `[文档片段 ${i + 1}]:\n${c}`).join("\n\n---\n\n");

  return `你是一个知识库问答助手。请根据以下文档内容回答用户的问题。

如果文档内容无法回答该问题，请明确说明"根据现有文档无法回答此问题"，不要编造答案。

文档内容：
${context}

用户问题：${question}

请用简洁、准确的中文回答。`;
}

/**
 * 执行 RAG 问答：嵌入问题 → 检索 → 构建 Prompt → LLM 回答。
 * 返回结构化结果（答案 + 引用来源）。
 */
export async function askWithRag(
  question: string,
  vectors: VectorEntry[],
  model?: string,
): Promise<RagAnswer> {
  const queryEmbedding = await getEmbedding(question);
  const results = retrieve(queryEmbedding, vectors, TOP_K);

  const chunks = results.map((r) => r.entry.chunk);
  const prompt = buildPrompt(question, chunks);

  const client = getClient();
  const modelName = model || DEFAULT_MODEL;

  const response = await client.chat.completions.create({
    model: modelName,
    temperature: 0.3,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const answer = response.choices[0]?.message?.content || "";

  const sources = results.map((r) => ({
    file: r.entry.source,
    index: r.entry.index,
    excerpt: r.entry.chunk.slice(0, 200),
    similarity: Number(r.similarity.toFixed(4)),
  }));

  return { answer, sources };
}
