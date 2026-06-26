/**
 * LangGraph vs 手写 ReAct Agent — 对比评估 runner
 *
 * 用同一套任务集（agent-eval-round-01.json）分别跑两版 Agent，
 * 复用 05-agent-eval 的判分逻辑（checkAgent + computeKeypointCoverage），
 * 产出 round-01-results.json + round-01-summary.md。
 *
 * 设计要点：
 *   - 直接 import 两版 runAgent（npm workspace 已把依赖提升到根 node_modules），
 *     不经过 HTTP 服务，省去起两个 server 的麻烦。
 *   - 两版输出归一化为统一的 { answer, steps:[{toolName}], iterations } 再判分。
 *   - 效率指标用「墙钟耗时 + 迭代轮数」做公平对比；token 仅 LangGraph 侧可从
 *     usage_metadata 取到，手写版未暴露 token，统计中标 N/A（见 summary 说明）。
 *
 * 用法：
 *   npx tsx experiments/langgraph-vs-handwritten/runner.ts --all
 *   npx tsx experiments/langgraph-vs-handwritten/runner.ts --task agent-002
 *   npx tsx experiments/langgraph-vs-handwritten/runner.ts --engine langgraph --task agent-002
 */

import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

// 先加载根 .env，供两版 Agent 读取模型 / API 配置
loadEnv({ path: resolve(REPO_ROOT, ".env"), override: true });

import { runAgent as runHandwritten } from "../../projects/04-dev-copilot/src/agent/index.js";
import { runAgent as runLangGraph } from "../../projects/06-langgraph-copilot/src/agent.js";
import {
  checkAgent,
  checksAllPassed,
  computeKeypointCoverage,
} from "../../projects/05-agent-eval/src/runner.js";

// ---- 任务集类型（仅取本 runner 需要的字段） ----

interface AgentTask {
  id: string;
  type: "agent";
  targetProject: string;
  difficulty: "simple" | "medium" | "hard";
  category: string;
  question: string;
  expectedTools: string[];
  expectedKeyPoints: string[];
  checks: {
    tool_path_ok: boolean;
    constraint_ok: boolean;
    keypoint_coverage: boolean;
    task_completed: boolean;
  };
  notes: string;
}

interface TaskSet {
  meta: { name: string; description: string; version: string };
  tasks: AgentTask[];
}

type Engine = "handwritten" | "langgraph";

/** 归一化后的单次运行输出 */
interface NormalizedRun {
  answer: string;
  toolNames: string[];
  iterations: number;
  latencyMs: number;
  /** token 用量；手写版暂未暴露，记 null */
  tokens: { input: number; output: number; total: number } | null;
  error?: string;
}

// ---- 调用两版 Agent，并归一化输出 ----

async function runHandwrittenTask(question: string): Promise<NormalizedRun> {
  const t0 = Date.now();
  try {
    const r = await runHandwritten(question, { silent: true });
    const toolNames = r.steps
      .map((s) => s.action?.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    return {
      answer: r.answer ?? "",
      toolNames,
      iterations: r.iterations ?? 0,
      latencyMs: Date.now() - t0,
      tokens: null, // 04 的 AgentResult 未暴露 token 总量（仅日志），公平起见标 N/A
    };
  } catch (err) {
    return {
      answer: "",
      toolNames: [],
      iterations: 0,
      latencyMs: Date.now() - t0,
      tokens: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runLangGraphTask(question: string): Promise<NormalizedRun> {
  const t0 = Date.now();
  try {
    // 不传 checkpointer：与手写版单次任务对齐（无跨调用记忆）
    const r = await runLangGraph(question, {});
    const messages = (r.messages ?? []) as Array<any>;

    // 工具序列：每条带 tool_calls 的 AIMessage 贡献其 tool_calls 名称
    const toolNames: string[] = [];
    let aiMessageCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    for (const m of messages) {
      const isAI = m?.constructor?.name?.includes("AIMessage") || "tool_calls" in m;
      if (isAI) {
        aiMessageCount++;
        const u = m.usage_metadata;
        if (u) {
          inputTokens += u.input_tokens ?? 0;
          outputTokens += u.output_tokens ?? 0;
        }
      }
      const calls = m?.tool_calls;
      if (Array.isArray(calls)) {
        for (const c of calls) if (c?.name) toolNames.push(c.name);
      }
    }

    const hasTokens = inputTokens > 0 || outputTokens > 0;
    return {
      answer: typeof r.answer === "string" ? r.answer : "",
      toolNames,
      // 迭代轮数：agent 节点执行次数 = AIMessage 数（与手写版 LLM 调用次数同义）
      iterations: aiMessageCount,
      latencyMs: Date.now() - t0,
      tokens: hasTokens
        ? { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens }
        : null,
    };
  } catch (err) {
    return {
      answer: "",
      toolNames: [],
      iterations: 0,
      latencyMs: Date.now() - t0,
      tokens: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function runEngine(engine: Engine, question: string): Promise<NormalizedRun> {
  return engine === "handwritten" ? runHandwrittenTask(question) : runLangGraphTask(question);
}

// ---- 单引擎在单任务上的判分 ----

interface EngineTaskResult {
  engine: Engine;
  run: NormalizedRun;
  checks: ReturnType<typeof checkAgent>;
  passed: boolean;
  keypoints: { matched: number; total: number };
}

function judge(engine: Engine, task: AgentTask, run: NormalizedRun): EngineTaskResult {
  const checks = checkAgent(
    {
      answer: run.answer,
      steps: run.toolNames.map((toolName) => ({ toolName })),
      iterations: run.iterations,
    },
    task as any,
  );
  const passed = checksAllPassed(checks);
  const kp = computeKeypointCoverage(task.expectedKeyPoints, run.answer);
  return {
    engine,
    run,
    checks,
    passed,
    keypoints: {
      matched: kp.details.filter((d) => d.ok).length,
      total: task.expectedKeyPoints.length,
    },
  };
}

// ---- 主流程 ----

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    all: args.includes("--all"),
    engine: get("--engine") as Engine | undefined,
    task: get("--task"),
  };
}

async function main() {
  const { all, engine, task: taskId } = parseArgs();

  const taskSetPath = resolve(REPO_ROOT, "experiments", "agent-evals", "agent-eval-round-01.json");
  const taskSet: TaskSet = JSON.parse(readFileSync(taskSetPath, "utf-8"));

  let tasks = taskSet.tasks.filter((t) => t.type === "agent");
  if (taskId) tasks = tasks.filter((t) => t.id === taskId);
  if (!all && !taskId) {
    console.log("用法: --all | --task <id> [--engine handwritten|langgraph]");
    process.exit(1);
  }
  if (tasks.length === 0) {
    console.log(`未找到任务${taskId ? ` ${taskId}` : ""}`);
    process.exit(1);
  }

  const engines: Engine[] = engine ? [engine] : ["handwritten", "langgraph"];

  console.log(`\n===== LangGraph vs 手写 对比评估 =====`);
  console.log(`模型: ${process.env.MODEL_NAME || "(未配置)"}`);
  console.log(`任务: ${tasks.map((t) => t.id).join(", ")}`);
  console.log(`引擎: ${engines.join(" + ")}\n`);

  const perTask: Array<{
    taskId: string;
    difficulty: string;
    category: string;
    question: string;
    expectedTools: string[];
    results: EngineTaskResult[];
  }> = [];

  for (const task of tasks) {
    console.log(
      `\n[${task.id}] (${task.difficulty}/${task.category}) ${task.question.slice(0, 50)}...`,
    );
    const results: EngineTaskResult[] = [];
    for (const eng of engines) {
      process.stdout.write(`   → ${eng} 执行中...`);
      const run = await runEngine(eng, task.question);
      const r = judge(eng, task, run);
      results.push(r);
      if (run.error) {
        console.log(` ❌ 错误: ${run.error}`);
      } else {
        console.log(
          ` ${r.passed ? "✅" : "❌"} ${run.iterations}轮 | ${(run.latencyMs / 1000).toFixed(1)}s` +
            ` | 工具: ${run.toolNames.join("→") || "(无)"} | ${r.keypoints.matched}/${r.keypoints.total}关键点` +
            (run.tokens ? ` | ${run.tokens.total} tok` : ""),
        );
      }
    }
    perTask.push({
      taskId: task.id,
      difficulty: task.difficulty,
      category: task.category,
      question: task.question,
      expectedTools: task.expectedTools,
      results,
    });
  }

  // ---- 汇总 ----
  const summaryByEngine: Record<
    string,
    { passed: number; total: number; avgLatencyMs: number; avgIterations: number }
  > = {};
  for (const eng of engines) {
    const rs = perTask.map((p) => p.results.find((r) => r.engine === eng)!).filter(Boolean);
    const passed = rs.filter((r) => r.passed).length;
    summaryByEngine[eng] = {
      passed,
      total: rs.length,
      avgLatencyMs: Math.round(
        rs.reduce((a, r) => a + r.run.latencyMs, 0) / Math.max(rs.length, 1),
      ),
      avgIterations:
        Math.round((rs.reduce((a, r) => a + r.run.iterations, 0) / Math.max(rs.length, 1)) * 10) /
        10,
    };
  }

  const report = {
    meta: {
      name: "round-01",
      date: new Date().toISOString().split("T")[0],
      model: process.env.MODEL_NAME || "",
      engines,
      taskSet: "agent-eval-round-01",
    },
    summaryByEngine,
    tasks: perTask.map((p) => ({
      taskId: p.taskId,
      difficulty: p.difficulty,
      category: p.category,
      question: p.question,
      expectedTools: p.expectedTools,
      results: p.results.map((r) => ({
        engine: r.engine,
        passed: r.passed,
        checks: r.checks,
        keypoints: r.keypoints,
        iterations: r.run.iterations,
        latencyMs: r.run.latencyMs,
        tokens: r.run.tokens,
        toolNames: r.run.toolNames,
        answerPreview: r.run.answer.slice(0, 400),
        error: r.run.error,
      })),
    })),
  };

  // 是否所有运行都出错（典型：LLM 端点不可达）。若是，则判定为「执行被阻断」，
  // 不生成会产生误导的 0/0 对比摘要，只落一份带 error 详情的 JSON 供排查。
  const allRuns = perTask.flatMap((p) => p.results);
  const allErrored = allRuns.length > 0 && allRuns.every((r) => r.run.error);
  (report.meta as any).blocked = allErrored;

  mkdirSync(__dirname, { recursive: true });
  const jsonPath = resolve(__dirname, "round-01-results.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n📄 结果: ${jsonPath}`);

  if (allErrored) {
    const sample = allRuns.find((r) => r.run.error)?.run.error ?? "";
    console.log(`\n⚠️  执行被阻断：所有运行均失败（未产出有效对比数据）。`);
    console.log(`   典型错误：${sample}`);
    console.log(`   多为 LLM 端点不可达 / 模型路由不匹配。请在可访问模型的网络环境下重跑。`);
    console.log(`   未生成 round-01-summary.md（避免把 API 失败误记为框架对比结论）。`);
    return;
  }

  // ---- 打印 + 生成 markdown 摘要 ----
  console.log(`\n===== 汇总 =====`);
  for (const eng of engines) {
    const s = summaryByEngine[eng];
    console.log(
      `${eng}: ${s.passed}/${s.total} 通过 | 平均 ${s.avgIterations} 轮 | 平均 ${(s.avgLatencyMs / 1000).toFixed(1)}s`,
    );
  }

  if (engines.length === 2) {
    writeFileSync(resolve(__dirname, "round-01-summary.md"), renderSummaryMd(report), "utf-8");
    console.log(`📄 摘要: ${resolve(__dirname, "round-01-summary.md")}`);
  }
}

function renderSummaryMd(report: any): string {
  const eng = report.meta.engines;
  const s = report.summaryByEngine;
  const lines: string[] = [];
  lines.push(`# LangGraph vs 手写 ReAct — 对比结果（${report.meta.date}）`);
  lines.push("");
  lines.push(
    `> 模型：${report.meta.model} ｜ 任务集：${report.meta.taskSet}（${report.tasks.length} 题）`,
  );
  lines.push("");
  lines.push(`## 总览`);
  lines.push("");
  lines.push(`| 引擎 | 通过率 | 平均迭代轮数 | 平均耗时 |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const e of eng) {
    lines.push(
      `| ${e} | ${s[e].passed}/${s[e].total} | ${s[e].avgIterations} | ${(s[e].avgLatencyMs / 1000).toFixed(1)}s |`,
    );
  }
  lines.push("");
  lines.push(`## 逐题对比`);
  lines.push("");
  lines.push(`| 任务 | 难度 | 手写 | LangGraph | 备注 |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const t of report.tasks) {
    const hw = t.results.find((r: any) => r.engine === "handwritten");
    const lg = t.results.find((r: any) => r.engine === "langgraph");
    const cell = (r: any) =>
      r
        ? `${r.passed ? "✅" : "❌"} ${r.iterations}轮/${r.keypoints.matched}-${r.keypoints.total}kp`
        : "—";
    lines.push(`| ${t.taskId} | ${t.difficulty} | ${cell(hw)} | ${cell(lg)} | ${t.category} |`);
  }
  lines.push("");
  lines.push(`> kp = 关键点命中数。详见 round-01-results.json。`);
  return lines.join("\n") + "\n";
}

main().catch((err) => {
  console.error("运行失败:", err);
  process.exit(1);
});
