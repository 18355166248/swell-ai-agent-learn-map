/**
 * 对比固定大小切分 vs 按标题切分的 chunk 质量和检索覆盖率。
 *
 * 使用方式: npx tsx experiments/chunk-strategies/compare.ts
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { chunkMarkdown, type ChunkEntry } from "../../projects/02-doc-rag/src/chunker.js";
import { chunkByHeading } from "../../projects/02-doc-rag/src/chunker-heading.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = resolve(__dirname, "..", "..", "projects", "02-doc-rag", "docs", "knowledge-base");
const EVAL_PATH = resolve(__dirname, "eval-dataset.json");

interface EvalCase {
  id: number;
  question: string;
  expectedAnswer: string;
  expectedSources: string[];
  keywords: string[];
  difficulty: string;
  category: string;
}

interface StrategyStats {
  name: string;
  totalChunks: number;
  avgSize: number;
  minSize: number;
  maxSize: number;
  medianSize: number;
  docBreakdown: { file: string; chunks: number }[];
  keywordHits: { evalId: number; hits: number; total: number; score: number }[];
  overallCoverage: number;
}

function loadDocs(): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];

  function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/\.(md|txt)$/i.test(entry.name)) {
        files.push({ path: fullPath, content: readFileSync(fullPath, "utf-8") });
      }
    }
  }

  walk(KB_DIR);
  return files;
}

function getRelativePath(absPath: string): string {
  return absPath
    .replace(KB_DIR, "")
    .replace(/^[\\/]/, "")
    .replace(/\\/g, "/");
}

function analyzeChunks(
  chunks: ChunkEntry[],
  name: string,
): Omit<StrategyStats, "keywordHits" | "overallCoverage"> {
  const sizes = chunks.map((c) => c.chunk.length).sort((a, b) => a - b);
  const totalSize = sizes.reduce((s, x) => s + x, 0);

  const docMap = new Map<string, number>();
  for (const c of chunks) {
    docMap.set(c.source, (docMap.get(c.source) || 0) + 1);
  }

  return {
    name,
    totalChunks: chunks.length,
    avgSize: chunks.length ? Math.round(totalSize / chunks.length) : 0,
    minSize: sizes.length ? sizes[0] : 0,
    maxSize: sizes.length ? sizes[sizes.length - 1] : 0,
    medianSize: sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0,
    docBreakdown: [...docMap.entries()].map(([file, chunks]) => ({ file, chunks })),
  };
}

function evaluateKeywords(
  chunks: ChunkEntry[],
  evalCases: EvalCase[],
): {
  keywordHits: { evalId: number; hits: number; total: number; score: number }[];
  overallCoverage: number;
} {
  const hits = evalCases.map((ec) => {
    let hitCount = 0;
    for (const kw of ec.keywords) {
      const lowerKw = kw.toLowerCase();
      const found = chunks.some((c) => c.chunk.toLowerCase().includes(lowerKw));
      if (found) hitCount++;
    }
    return {
      evalId: ec.id,
      hits: hitCount,
      total: ec.keywords.length,
      score: ec.keywords.length > 0 ? hitCount / ec.keywords.length : 0,
    };
  });

  const overall = hits.length > 0 ? hits.reduce((s, h) => s + h.score, 0) / hits.length : 0;

  return { keywordHits: hits, overallCoverage: overall };
}

function printStats(stats: StrategyStats) {
  console.log(`\n===== ${stats.name} =====`);
  console.log(`总块数:     ${stats.totalChunks}`);
  console.log(`平均大小:   ${stats.avgSize} 字符`);
  console.log(`中位数大小: ${stats.medianSize} 字符`);
  console.log(`最小/最大:  ${stats.minSize} / ${stats.maxSize} 字符`);
  console.log(`按文档分布:`);
  for (const d of stats.docBreakdown) {
    console.log(`  ${d.file}: ${d.chunks} 块`);
  }

  console.log(`\n关键词覆盖率 (逐题):`);
  for (const h of stats.keywordHits) {
    const bar = "▓".repeat(Math.round(h.score * 20)) + "░".repeat(20 - Math.round(h.score * 20));
    console.log(`  Q${h.evalId}: [${bar}] ${h.hits}/${h.total} (${(h.score * 100).toFixed(0)}%)`);
  }
  console.log(`\n整体覆盖率: ${(stats.overallCoverage * 100).toFixed(1)}%`);
}

function printComparison(a: StrategyStats, b: StrategyStats) {
  console.log("\n========== 对比结论 ==========");
  console.log(
    `块数变化:   ${a.totalChunks} → ${b.totalChunks} (${(((b.totalChunks - a.totalChunks) / a.totalChunks) * 100).toFixed(0)}%)`,
  );
  console.log(`平均大小:   ${a.avgSize} → ${b.avgSize} 字符`);
  console.log(
    `覆盖率变化: ${(a.overallCoverage * 100).toFixed(1)}% → ${(b.overallCoverage * 100).toFixed(1)}%`,
  );

  const improved = b.keywordHits.filter((h, i) => h.score > a.keywordHits[i].score);
  const same = b.keywordHits.filter((h, i) => h.score === a.keywordHits[i].score);
  const worse = b.keywordHits.filter((h, i) => h.score < a.keywordHits[i].score);

  console.log(`提升: ${improved.length} 题, 持平: ${same.length} 题, 下降: ${worse.length} 题`);
  if (improved.length > 0) {
    console.log(`提升的题目: ${improved.map((h) => `Q${h.evalId}`).join(", ")}`);
  }
  if (worse.length > 0) {
    console.log(`下降的题目: ${worse.map((h) => `Q${h.evalId}`).join(", ")}`);
  }
}

// ---- main ----
const docs = loadDocs();
const evalCases: EvalCase[] = JSON.parse(readFileSync(EVAL_PATH, "utf-8"));

console.log(`知识库文档数: ${docs.length}`);
console.log(`评估用例数:   ${evalCases.length}`);

// 固定大小切分
const fixedChunks: ChunkEntry[] = [];
for (const doc of docs) {
  const relPath = getRelativePath(doc.path);
  fixedChunks.push(...chunkMarkdown(doc.content, relPath));
}

// 按标题切分
const headingChunks: ChunkEntry[] = [];
for (const doc of docs) {
  const relPath = getRelativePath(doc.path);
  headingChunks.push(...chunkByHeading(doc.content, relPath));
}

// 分析
const fixedStatsRaw = analyzeChunks(fixedChunks, "固定大小切分 (500 字阈值)");
const fixedEval = evaluateKeywords(fixedChunks, evalCases);
const fixedStats: StrategyStats = {
  ...fixedStatsRaw,
  ...fixedEval,
};

const headingStatsRaw = analyzeChunks(headingChunks, "按标题切分");
const headingEval = evaluateKeywords(headingChunks, evalCases);
const headingStats: StrategyStats = {
  ...headingStatsRaw,
  ...headingEval,
};

printStats(fixedStats);
printStats(headingStats);
printComparison(fixedStats, headingStats);
