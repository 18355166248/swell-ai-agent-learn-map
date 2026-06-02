import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { getEmbedding } from "./embedder.js";
import { rewriteQuery } from "./query-rewriter.js";
import { retrieve, type VectorEntry } from "./retriever.js";
import { BM25Search, hybridRetrieve } from "./keyword-search.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const TOP_K = 3;

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

export interface RagOptions {
  /** 是否启用 Query 改写，默认 false */
  rewrite?: boolean;
  /** 是否启用混合检索（向量 + BM25 关键词），默认 false */
  hybrid?: boolean;
  /** LLM 模型名，不传则使用默认值 */
  model?: string;
}

interface ScoredChunk {
  entry: VectorEntry;
  score: number;
}

/**
 * 执行 RAG 问答：嵌入问题 → 检索 → 构建 Prompt → LLM 回答。
 * 返回结构化结果（答案 + 引用来源）。
 */
export async function askWithRag(
  question: string,
  vectors: VectorEntry[],
  options: RagOptions = {},
): Promise<RagAnswer> {
  // Query 改写：用改写词扩展原始问题，混合后嵌入
  let searchQuery = question;
  if (options.rewrite) {
    const expanded = await rewriteQuery(question, options.model);
    searchQuery = `${question} | ${expanded}`;
  }

  // 向量检索
  const queryEmbedding = await getEmbedding(searchQuery);
  const vectorResults = retrieve(queryEmbedding, vectors, options.hybrid ? TOP_K * 2 : TOP_K);

  let results: ScoredChunk[];

  if (options.hybrid) {
    // 混合检索：向量 + BM25 → RRF 融合
    const bm25 = new BM25Search(vectors);
    const keywordResults = bm25.search(question, TOP_K * 2);
    results = hybridRetrieve(vectorResults, keywordResults, TOP_K).map((result) => ({
      entry: result.entry,
      score: result.score,
    }));
  } else {
    results = vectorResults.map((result) => ({
      entry: result.entry,
      score: result.similarity,
    }));
  }

  const chunks = results.map((r) => r.entry.chunk);
  const prompt = buildPrompt(question, chunks);

  const client = getClient();
  const modelName = resolveModelName(options.model);

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
    similarity: Number(r.score.toFixed(4)),
  }));

  return { answer, sources };
}
