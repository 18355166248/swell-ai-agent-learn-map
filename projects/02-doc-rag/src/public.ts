import { getEmbedding } from "./embedder.js";
import { rewriteQuery } from "./query-rewriter.js";
import { retrieve, type VectorEntry } from "./retriever.js";
import { BM25Search, hybridRetrieve } from "./keyword-search.js";

export { askWithRag, type RagAnswer, type RagOptions } from "./rag.js";
export type { VectorEntry } from "./retriever.js";

export interface SearchRelevantChunksOptions {
  hybrid?: boolean;
  rewrite?: boolean;
  topK?: number;
  model?: string;
}

export interface SearchRelevantChunkResult {
  entry: VectorEntry;
  score: number;
}

export async function searchRelevantChunks(
  question: string,
  vectors: VectorEntry[],
  options: SearchRelevantChunksOptions = {},
): Promise<SearchRelevantChunkResult[]> {
  const { hybrid = true, rewrite = true, topK = 5, model } = options;

  let searchQuery = question;
  if (rewrite) {
    const expanded = await rewriteQuery(question, model);
    searchQuery = `${question} | ${expanded}`;
  }

  const queryEmbedding = await getEmbedding(searchQuery);
  const vectorResults = retrieve(queryEmbedding, vectors, hybrid ? topK + 1 : topK);

  if (!hybrid) {
    return vectorResults.map((result) => ({
      entry: result.entry,
      score: result.similarity,
    }));
  }

  const bm25 = new BM25Search(vectors);
  const keywordResults = bm25.search(searchQuery, topK + 1);
  const results = hybridRetrieve(vectorResults, keywordResults, topK);

  return results.map((result) => ({
    entry: result.entry,
    score: result.score,
  }));
}
