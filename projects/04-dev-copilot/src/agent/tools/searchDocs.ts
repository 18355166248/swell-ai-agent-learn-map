import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { searchRelevantChunks, type VectorEntry } from "doc-rag";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 尝试多个可能的向量索引路径
const CANDIDATE_PATHS = [
  resolve(__dirname, "..", "..", "..", "..", "02-doc-rag", ".data", "vectors.json"),
  resolve(__dirname, "..", "..", "..", "..", "03-req-analyst", ".data", "vectors.json"),
];

let _cachedVectors: VectorEntry[] | null = null;

function loadVectors(): VectorEntry[] {
  if (_cachedVectors) return _cachedVectors;

  // 合并所有可用的向量索引
  const all: VectorEntry[] = [];
  for (const p of CANDIDATE_PATHS) {
    if (existsSync(p)) {
      try {
        const loaded: VectorEntry[] = JSON.parse(readFileSync(p, "utf-8"));
        all.push(...loaded);
      } catch {
        /* skip corrupt index */
      }
    }
  }

  _cachedVectors = all;
  return _cachedVectors;
}

export async function searchDocs(args: { query: string }, _projectRoot: string): Promise<string> {
  const vectors = loadVectors();

  if (vectors.length === 0) {
    return "文档索引尚未建立。请先在 02-doc-rag 中运行 `npm run index` 构建向量索引。";
  }

  const results = await searchRelevantChunks(args.query, vectors, {
    hybrid: true,
    rewrite: true,
    topK: 5,
  });

  if (results.length === 0) {
    return "未找到相关文档。";
  }

  const formatted = results.map((r, i) => {
    const src = r.entry.source.replace(/\\/g, "/");
    return `[${i + 1}] ${src}#${r.entry.index} (分数: ${r.score.toFixed(4)})\n---\n${r.entry.chunk.slice(0, 800)}`;
  });

  return `找到 ${results.length} 个相关文档片段:\n\n${formatted.join("\n\n")}`;
}
