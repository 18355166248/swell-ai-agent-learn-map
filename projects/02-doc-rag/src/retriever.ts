import type { Embedding } from "./embedder.js";

/** 向量存储条目 */
export interface VectorEntry {
  chunk: string;
  embedding: Embedding;
  source: string;
  index: number;
}

/** 检索结果 */
export interface RetrievalResult {
  entry: VectorEntry;
  similarity: number;
}

/** 计算向量的点积 */
export function dotProduct(a: Embedding, b: Embedding): number {
  if (a.length !== b.length) {
    throw new Error(`向量维度不匹配: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** 计算向量的模（欧几里得范数） */
export function magnitude(v: Embedding): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

/**
 * 计算两个向量的余弦相似度。
 * 结果范围 [-1, 1]，越接近 1 表示越相似。
 *    cos(a, b) = (a · b) / (|a| × |b|)
 */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
  const dot = dotProduct(a, b);
  const magA = magnitude(a);
  const magB = magnitude(b);

  // 零向量边界保护
  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (magA * magB);
}

/**
 * 从向量库中检索与查询向量最相似的 Top-K 条目。
 * 返回按相似度降序排列的结果列表。
 */
export function retrieve(
  queryEmbedding: Embedding,
  entries: VectorEntry[],
  topK: number = 3,
): RetrievalResult[] {
  const scored = entries.map((entry) => ({
    entry,
    similarity: cosineSimilarity(queryEmbedding, entry.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}
