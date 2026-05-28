/**
 * 对比 Query 改写前后的检索命中率。
 *
 * 使用方式: npx tsx experiments/chunk-strategies/compare-rewrite.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getEmbedding } from "../../projects/02-doc-rag/src/embedder.js";
import { rewriteQuery } from "../../projects/02-doc-rag/src/query-rewriter.js";
import { retrieve, type VectorEntry } from "../../projects/02-doc-rag/src/retriever.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VECTORS_PATH = resolve(
  __dirname,
  "..",
  "..",
  "projects",
  "02-doc-rag",
  ".data",
  "vectors.json",
);
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

interface RetrievalReport {
  evalId: number;
  question: string;
  difficulty: string;
  originalHits: number;
  rewrittenHits: number;
  originalSources: string[];
  rewrittenSources: string[];
  rewrittenQuery: string;
}

async function evaluate(
  evalCase: EvalCase,
  vectors: VectorEntry[],
  topK: number,
): Promise<RetrievalReport> {
  // 改写
  const expanded = await rewriteQuery(evalCase.question);
  const rewritten = `${evalCase.question} | ${expanded}`;

  // 嵌入 + 检索（原始）
  const origEmb = await getEmbedding(evalCase.question);
  const origResults = retrieve(origEmb, vectors, topK);
  const origSources = origResults.map((r) => r.entry.source);
  const origHits = origSources.filter((s) =>
    evalCase.expectedSources.some((es) => s.includes(es) || es.includes(s)),
  ).length;

  // 嵌入 + 检索（改写后）
  const rewEmb = await getEmbedding(rewritten);
  const rewResults = retrieve(rewEmb, vectors, topK);
  const rewSources = rewResults.map((r) => r.entry.source);
  const rewHits = rewSources.filter((s) =>
    evalCase.expectedSources.some((es) => s.includes(es) || es.includes(s)),
  ).length;

  return {
    evalId: evalCase.id,
    question: evalCase.question,
    difficulty: evalCase.difficulty,
    originalHits: origHits,
    rewrittenHits: rewHits,
    originalSources: origSources,
    rewrittenSources: rewSources,
    rewrittenQuery: expanded,
  };
}

function printReport(reports: RetrievalReport[], topK: number) {
  console.log(`\n========== Query 改写对比 (Top-${topK}) ==========\n`);

  let origTotal = 0;
  let rewTotal = 0;
  const improvements: { id: number; delta: number }[] = [];

  for (const r of reports) {
    const delta = r.rewrittenHits - r.originalHits;
    const marker = delta > 0 ? "⬆" : delta < 0 ? "⬇" : "➡";
    origTotal += r.originalHits;
    rewTotal += r.rewrittenHits;
    if (delta !== 0) improvements.push({ id: r.evalId, delta });

    console.log(`Q${r.evalId} [${r.difficulty}] ${r.question}`);
    console.log(`  改写: ${r.rewrittenQuery}`);
    console.log(
      `  原始命中:   ${r.originalHits}/${topK}  →  ${r.originalSources.join(", ") || "(无)"}`,
    );
    console.log(
      `  改写后命中: ${r.rewrittenHits}/${topK}  →  ${r.rewrittenSources.join(", ") || "(无)"}  ${marker}`,
    );
    console.log();
  }

  const totalPossible = reports.length * topK;
  console.log("========== 汇总 ==========");
  console.log(
    `原始总命中率:   ${origTotal}/${totalPossible} (${((origTotal / totalPossible) * 100).toFixed(1)}%)`,
  );
  console.log(
    `改写后总命中率: ${rewTotal}/${totalPossible} (${((rewTotal / totalPossible) * 100).toFixed(1)}%)`,
  );
  console.log(`提升:           ${rewTotal - origTotal} 次命中`);

  if (improvements.length > 0) {
    console.log(`\n变化的题目:`);
    for (const imp of improvements) {
      console.log(`  Q${imp.id}: ${imp.delta > 0 ? "+" : ""}${imp.delta}`);
    }
  }

  // 按难度分组
  console.log(`\n按难度分组:`);
  for (const diff of ["simple", "medium", "hard"]) {
    const group = reports.filter((r) => r.difficulty === diff);
    if (group.length === 0) continue;
    const gOrig = group.reduce((s, r) => s + r.originalHits, 0);
    const gRew = group.reduce((s, r) => s + r.rewrittenHits, 0);
    const gTotal = group.length * topK;
    console.log(
      `  ${diff}: ${gOrig}/${gTotal} → ${gRew}/${gTotal} (${gRew > gOrig ? "+" : ""}${gRew - gOrig})`,
    );
  }
}

// ---- main ----
async function main() {
  if (!existsSync(VECTORS_PATH)) {
    console.error("vectors.json 不存在，请先运行 npm run index");
    process.exit(1);
  }

  const vectors: VectorEntry[] = JSON.parse(readFileSync(VECTORS_PATH, "utf-8"));
  const evalCases: EvalCase[] = JSON.parse(readFileSync(EVAL_PATH, "utf-8"));
  const TOP_K = 3;

  console.log(`向量条目数: ${vectors.length}`);
  console.log(`评估用例数: ${evalCases.length}`);
  console.log(`Top-K: ${TOP_K}`);
  console.log(`\n正在对比...`);

  const reports: RetrievalReport[] = [];
  for (const ec of evalCases) {
    try {
      const report = await evaluate(ec, vectors, TOP_K);
      reports.push(report);
      console.log(`  Q${ec.id} 完成`);
    } catch (err: any) {
      console.error(`  Q${ec.id} 失败: ${err.message}`);
      // 失败时填入空报告
      reports.push({
        evalId: ec.id,
        question: ec.question,
        difficulty: ec.difficulty,
        originalHits: 0,
        rewrittenHits: 0,
        originalSources: [],
        rewrittenSources: [],
        rewrittenQuery: `ERROR: ${err.message}`,
      });
    }
  }

  printReport(reports, TOP_K);
}

main().catch((err) => {
  console.error("执行失败:", err.message);
  process.exit(1);
});
