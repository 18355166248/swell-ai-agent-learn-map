import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, statSync } from "fs";
import { searchRelevantChunks, type VectorEntry } from "doc-rag";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 尝试多个可能的向量索引路径
const CANDIDATE_PATHS = [
  resolve(__dirname, "..", "..", "..", "..", "02-doc-rag", ".data", "vectors.json"),
  resolve(__dirname, "..", "..", "..", "..", "03-req-analyst", ".data", "vectors.json"),
];

let _cachedVectors: VectorEntry[] | null = null;
let _cachedMtimes: Record<string, number> = {};

function loadVectors(): VectorEntry[] {
  // 检查任一候选文件的 mtime 是否变化（新增、修改、删除）
  let needsReload = _cachedVectors === null;

  if (!needsReload) {
    for (const p of CANDIDATE_PATHS) {
      const prevMtime = _cachedMtimes[p] ?? 0;
      let currMtime = 0;
      try {
        currMtime = statSync(p).mtimeMs;
      } catch {
        /* 文件不存在，mtime 视为 0 */
      }
      if (currMtime !== prevMtime) {
        needsReload = true;
        break;
      }
    }
  }

  if (!needsReload) return _cachedVectors!;

  // 重新加载：合并所有可用的向量索引
  const all: VectorEntry[] = [];
  const newMtimes: Record<string, number> = {};

  for (const p of CANDIDATE_PATHS) {
    let mtime = 0;
    try {
      mtime = statSync(p).mtimeMs;
    } catch {
      /* 文件不存在 */
    }
    newMtimes[p] = mtime;

    if (mtime > 0) {
      try {
        const loaded: VectorEntry[] = JSON.parse(readFileSync(p, "utf-8"));
        all.push(...loaded);
      } catch {
        /* skip corrupt index */
      }
    }
  }

  _cachedVectors = all;
  _cachedMtimes = newMtimes;
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

// 仅供测试使用：重置向量缓存状态
export function _resetCache(): void {
  _cachedVectors = null;
  _cachedMtimes = {};
}
