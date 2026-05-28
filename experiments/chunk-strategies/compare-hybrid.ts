/**
 * 对比三种检索策略：向量检索 / BM25 关键词 / 混合检索
 *
 * 使用方式: npx tsx experiments/chunk-strategies/compare-hybrid.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getEmbedding } from "../../projects/02-doc-rag/src/embedder.js";
import { rewriteQuery } from "../../projects/02-doc-rag/src/query-rewriter.js";
import { retrieve, type VectorEntry } from "../../projects/02-doc-rag/src/retriever.js";
import { BM25Search, hybridRetrieve } from "../../projects/02-doc-rag/src/keyword-search.js";

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
  expectedSources: string[];
  keywords: string[];
  difficulty: string;
  category: string;
}

interface StrategyReport {
  name: string;
  hits: number[];
  totalHits: number;
  totalPossible: number;
  rate: number;
}

function hitCount(
  results: { entry: VectorEntry; score?: number; similarity?: number }[],
  expectedSources: string[],
): number {
  return results.filter((r) =>
    expectedSources.some((es) => r.entry.source.includes(es) || es.includes(r.entry.source)),
  ).length;
}

async function main() {
  if (!existsSync(VECTORS_PATH)) {
    console.error("vectors.json 不存在，请先运行 npm run index");
    process.exit(1);
  }

  const vectors: VectorEntry[] = JSON.parse(readFileSync(VECTORS_PATH, "utf-8"));
  const evalCases: EvalCase[] = JSON.parse(readFileSync(EVAL_PATH, "utf-8"));
  const TOP_K = 3;

  // 构建 BM25 索引
  const bm25 = new BM25Search(vectors);
  console.log(`BM25 索引就绪: ${vectors.length} 篇文档, IDF 词数: ${(bm25 as any).idf.size}`);

  // 初始化各策略报告
  const vectorReport: StrategyReport = {
    name: "向量检索",
    hits: [],
    totalHits: 0,
    totalPossible: 0,
    rate: 0,
  };
  const bm25Report: StrategyReport = {
    name: "BM25 关键词",
    hits: [],
    totalHits: 0,
    totalPossible: 0,
    rate: 0,
  };
  const hybridReport: StrategyReport = {
    name: "混合检索",
    hits: [],
    totalHits: 0,
    totalPossible: 0,
    rate: 0,
  };

  console.log(`\n正在逐题评估...`);

  for (const ec of evalCases) {
    try {
      // Query 改写（混合检索也会用到）
      const expanded = await rewriteQuery(ec.question);
      const searchQuery = `${ec.question} | ${expanded}`;

      // 1) 纯向量检索
      const queryEmb = await getEmbedding(searchQuery);
      const vecResults = retrieve(queryEmb, vectors, TOP_K);
      const vHits = hitCount(vecResults, ec.expectedSources);
      vectorReport.hits.push(vHits);

      // 2) 纯 BM25 检索
      const kwResults = bm25.search(searchQuery, TOP_K);
      const kHits = hitCount(kwResults as any, ec.expectedSources);
      bm25Report.hits.push(kHits);

      // 3) 混合检索（向量 + BM25）
      const vecCandidates = retrieve(queryEmb, vectors, TOP_K * 2);
      const kwCandidates = bm25.search(searchQuery, TOP_K * 2);
      const hyResults = hybridRetrieve(vecCandidates, kwCandidates, TOP_K);
      const hHits = hitCount(hyResults, ec.expectedSources);
      hybridReport.hits.push(hHits);

      console.log(`  Q${ec.id} [${ec.difficulty}] 向量:${vHits}  BM25:${kHits}  混合:${hHits}`);
    } catch (err: any) {
      console.error(`  Q${ec.id} 失败: ${err.message}`);
      vectorReport.hits.push(0);
      bm25Report.hits.push(0);
      hybridReport.hits.push(0);
    }
  }

  // 汇总
  for (const report of [vectorReport, bm25Report, hybridReport]) {
    report.totalHits = report.hits.reduce((s, h) => s + h, 0);
    report.totalPossible = report.hits.length * TOP_K;
    report.rate = report.totalPossible > 0 ? report.totalHits / report.totalPossible : 0;
  }

  // 输出对比
  console.log(`\n========== 三策略对比 (Top-${TOP_K}) ==========\n`);

  // 表头
  console.log("题目            │ 向量 │ BM25 │ 混合 │ 最佳");
  console.log("────────────────┼──────┼──────┼──────┼──────");
  for (let i = 0; i < evalCases.length; i++) {
    const ec = evalCases[i];
    const values = [vectorReport.hits[i], bm25Report.hits[i], hybridReport.hits[i]];
    const best = Math.max(...values);
    const markers = values.map((v) => (v === best ? `*${v}*` : ` ${v} `));
    console.log(
      `Q${ec.id} [${ec.difficulty.padEnd(6)}] │ ${markers[0]}  │ ${markers[1]}  │ ${markers[2]}  │ ${
        best === values[0] ? "向量" : best === values[1] ? "BM25" : "混合"
      }`,
    );
  }

  console.log("────────────────┼──────┼──────┼──────┼──────");
  console.log(
    `总计            │ ${vectorReport.totalHits}/${vectorReport.totalPossible} │ ${bm25Report.totalHits}/${bm25Report.totalPossible} │ ${hybridReport.totalHits}/${hybridReport.totalPossible} │`,
  );

  console.log(`\n========== 命中率 ==========`);
  console.log(`向量检索:   ${(vectorReport.rate * 100).toFixed(1)}%`);
  console.log(`BM25 关键词: ${(bm25Report.rate * 100).toFixed(1)}%`);
  console.log(`混合检索:   ${(hybridReport.rate * 100).toFixed(1)}%`);

  // 按难度分组
  console.log(`\n========== 按难度分组 ==========`);
  for (const diff of ["simple", "medium", "hard"]) {
    const indices = evalCases.reduce<number[]>((arr, ec, i) => {
      if (ec.difficulty === diff) arr.push(i);
      return arr;
    }, []);
    if (indices.length === 0) continue;

    const vSum = indices.reduce((s, i) => s + vectorReport.hits[i], 0);
    const kSum = indices.reduce((s, i) => s + bm25Report.hits[i], 0);
    const hSum = indices.reduce((s, i) => s + hybridReport.hits[i], 0);
    const total = indices.length * TOP_K;

    console.log(
      `  ${diff}: 向量=${vSum}/${total} (${((vSum / total) * 100).toFixed(0)}%)  BM25=${kSum}/${total} (${((kSum / total) * 100).toFixed(0)}%)  混合=${hSum}/${total} (${((hSum / total) * 100).toFixed(0)}%)`,
    );
  }

  // 改进统计
  let hybridWins = 0;
  let hybridLoses = 0;
  for (let i = 0; i < evalCases.length; i++) {
    if (hybridReport.hits[i] > vectorReport.hits[i]) hybridWins++;
    if (hybridReport.hits[i] < vectorReport.hits[i]) hybridLoses++;
  }
  console.log(
    `\n混合 vs 向量: 提升 ${hybridWins} 题, 下降 ${hybridLoses} 题, 持平 ${evalCases.length - hybridWins - hybridLoses} 题`,
  );
}

main().catch((err) => {
  console.error("执行失败:", err.message);
  process.exit(1);
});
