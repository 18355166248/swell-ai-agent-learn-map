import type { VectorEntry } from "./retriever.js";

/** BM25 检索结果 */
export interface KeywordResult {
  entry: VectorEntry;
  score: number;
}

/**
 * 简易分词：中文字符二元组 + 英文/数字按空白分词 + 标点过滤。
 * 不依赖外部分词库，适合关键词匹配场景。
 */
function tokenize(text: string): string[] {
  if (!text) return [];

  const tokens: string[] = [];
  // 按非字母数字/中文/空白字符切分
  const segments = text
    .toLowerCase()
    .split(/[^\w一-鿿]+/)
    .filter(Boolean);

  for (const seg of segments) {
    if (/^[一-鿿]+$/.test(seg)) {
      // 中文：用字符二元组
      if (seg.length === 1) {
        tokens.push(seg);
      } else {
        for (let i = 0; i < seg.length - 1; i++) {
          tokens.push(seg.slice(i, i + 2));
        }
      }
    } else {
      // 英文/数字：直接作为 token
      if (seg.length >= 2) tokens.push(seg);
    }
  }

  return tokens;
}

/**
 * 轻量 BM25 检索引擎。
 * k1 控制词频饱和度，b 控制文档长度归一化。
 */
export class BM25Search {
  private chunks: VectorEntry[];
  private tokenizedDocs: string[][];
  private avgdl: number;
  private idf: Map<string, number> = new Map();
  private k1: number;
  private b: number;

  constructor(chunks: VectorEntry[], k1 = 1.5, b = 0.75) {
    this.chunks = chunks;
    this.k1 = k1;
    this.b = b;
    this.tokenizedDocs = chunks.map((c) => tokenize(c.chunk));

    const docCount = chunks.length;
    const totalLen = this.tokenizedDocs.reduce((s, t) => s + t.length, 0);
    this.avgdl = docCount > 0 ? totalLen / docCount : 0;

    // 预计算 IDF
    const df = new Map<string, number>();
    for (const tokens of this.tokenizedDocs) {
      const seen = new Set<string>();
      for (const t of tokens) {
        if (!seen.has(t)) {
          seen.add(t);
          df.set(t, (df.get(t) || 0) + 1);
        }
      }
    }

    for (const [term, freq] of df) {
      this.idf.set(term, Math.log((docCount - freq + 0.5) / (freq + 0.5) + 1));
    }
  }

  /** 对单个查询搜索，返回带 BM25 分数的结果列表（按分数降序） */
  search(query: string, topK: number = 5): KeywordResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const results: KeywordResult[] = [];

    for (let i = 0; i < this.chunks.length; i++) {
      const docTokens = this.tokenizedDocs[i];
      const docLen = docTokens.length;
      if (docLen === 0) continue;

      let score = 0;
      for (const qt of queryTokens) {
        const idf = this.idf.get(qt) || 0;
        if (idf === 0) continue;

        const tf = docTokens.filter((t) => t === qt).length;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
        score += idf * (numerator / denominator);
      }

      if (score > 0) {
        results.push({ entry: this.chunks[i], score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

/**
 * 混合检索：向量检索结果 + BM25 关键词检索结果，通过 RRF (Reciprocal Rank Fusion) 合并排序。
 * 返回融合后的 topK 结果。
 */
export function hybridRetrieve(
  vectorResults: { entry: VectorEntry; similarity: number }[],
  keywordResults: KeywordResult[],
  topK: number = 3,
  vectorWeight: number = 0.6,
): { entry: VectorEntry; score: number }[] {
  const k = 60; // RRF 平滑常数
  const scoreMap = new Map<string, { entry: VectorEntry; score: number }>();

  const entryKey = (e: VectorEntry) => `${e.source}:${e.index}`;

  // 向量结果分数
  for (let i = 0; i < vectorResults.length; i++) {
    const key = entryKey(vectorResults[i].entry);
    const rrf = vectorWeight / (k + i + 1);
    scoreMap.set(key, { entry: vectorResults[i].entry, score: rrf });
  }

  // 关键词结果分数
  const kwWeight = 1 - vectorWeight;
  for (let i = 0; i < keywordResults.length; i++) {
    const key = entryKey(keywordResults[i].entry);
    const rrf = kwWeight / (k + i + 1);
    const existing = scoreMap.get(key);
    if (existing) {
      existing.score += rrf;
    } else {
      scoreMap.set(key, { entry: keywordResults[i].entry, score: rrf });
    }
  }

  return [...scoreMap.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}
