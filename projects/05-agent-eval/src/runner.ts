import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { SERVICES, DEFAULT_CONFIG, OUTPUT_DIR } from "./config.js";
import type {
  EvalType,
  EvalTaskResult,
  EvalRoundReport,
  CheckResult,
  FailureType,
} from "./schema.js";

// ---- 类型定义（任务集输入格式） ----

interface RagTask {
  id: string;
  type: "rag";
  targetProject: string;
  difficulty: "simple" | "medium" | "hard";
  category: string;
  question: string;
  expectedSources: string[];
  expectedKeyPoints: string[];
  checks: { retrieval_hit: boolean; citation_ok: boolean; task_completed: boolean };
  notes: string;
}

interface AgentTask {
  id: string;
  type: "agent";
  targetProject: string;
  difficulty: "simple" | "medium" | "hard";
  category: string;
  question: string;
  expectedTools: string[];
  expectedKeyPoints: string[];
  checks: { tool_path_ok: boolean; constraint_ok: boolean; task_completed: boolean };
  notes: string;
}

interface ReqAnalystTask {
  id: string;
  type: "req-analyst";
  targetProject: string;
  difficulty: "simple" | "medium" | "hard";
  category: string;
  question: string;
  expectedSources?: string[];
  expectedKeyPoints: string[];
  checks: {
    field_completeness: boolean;
    spec_accuracy: boolean;
    scenario_adaptation: boolean;
  };
  notes: string;
}

type EvalTask = RagTask | AgentTask | ReqAnalystTask;

interface TaskSet {
  meta: { name: string; description: string; version: string };
  tasks: EvalTask[];
}

// ---- API 调用 ----

async function checkService(
  url: string,
  name: string,
  projectDir: string,
  healthPath: string,
): Promise<void> {
  try {
    const res = await fetch(`${url}${healthPath}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      console.log(`   ✅ ${name} (${url}) 已就绪`);
    } else {
      console.log(`   ⚠️  ${name} (${url}) 返回 ${res.status}`);
    }
  } catch {
    console.log(`   ❌ ${name} (${url}) 未启动 — 请先运行: cd projects/${projectDir} && npm start`);
  }
}

export async function checkAllServices(): Promise<void> {
  console.log("🔍 检查服务状态...\n");
  await Promise.all([
    checkService(SERVICES.rag, "rag", "02-doc-rag", "/api/status"),
    checkService(SERVICES["req-analyst"], "req-analyst", "03-req-analyst", "/api/status"),
    checkService(SERVICES.agent, "agent", "04-dev-copilot", "/api/health"),
  ]);
  console.log("");
}

async function callRag(question: string): Promise<{
  answer: string;
  sources: string[];
}> {
  const res = await fetch(`${SERVICES.rag}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, rewrite: true }),
    signal: AbortSignal.timeout(DEFAULT_CONFIG.timeout),
  }).catch(() => {
    throw new Error(
      `RAG 服务未响应 (${SERVICES.rag}) — 请先启动: cd projects/02-doc-rag && npm start`,
    );
  });
  if (!res.ok) {
    throw new Error(`RAG API 返回 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    answer: string;
    sources: Array<{ file: string }>;
  };
  return {
    answer: data.answer ?? "",
    sources: (data.sources ?? []).map((s) => s.file),
  };
}

async function callAgent(task: string): Promise<{
  answer: string;
  steps: Array<{ toolName?: string; toolArgs?: Record<string, unknown>; error?: string }>;
  iterations: number;
}> {
  const res = await fetch(`${SERVICES.agent}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
    signal: AbortSignal.timeout(DEFAULT_CONFIG.timeout),
  }).catch(() => {
    throw new Error(
      `Agent 服务未响应 (${SERVICES.agent}) — 请先启动: cd projects/04-dev-copilot && npm start`,
    );
  });
  if (!res.ok) {
    throw new Error(`Agent API 返回 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    answer: string;
    steps: Array<{
      action?: string;
      toolName?: string;
      toolArgs?: Record<string, unknown>;
      error?: string;
    }>;
    iterations: number;
  };
  return {
    answer: data.answer ?? "",
    steps: (data.steps ?? []).map((s) => ({
      toolName: s.toolName ?? s.action,
      toolArgs: s.toolArgs,
      error: s.error,
    })),
    iterations: data.iterations ?? 0,
  };
}

async function callReqAnalyst(requirement: string): Promise<{
  answer: string;
  fields: Record<string, number>;
}> {
  const res = await fetch(`${SERVICES["req-analyst"]}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirement }),
    signal: AbortSignal.timeout(DEFAULT_CONFIG.timeout),
  }).catch(() => {
    throw new Error(
      `Req-Analyst 服务未响应 (${SERVICES["req-analyst"]}) — 请先启动: cd projects/03-req-analyst && npm start`,
    );
  });
  if (!res.ok) {
    throw new Error(`Req-Analyst API 返回 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  const dims = [
    "pageChanges",
    "apiDependencies",
    "trackingRequirements",
    "componentDependencies",
    "risks",
    "testSuggestions",
  ];
  const fields: Record<string, number> = {};
  for (const dim of dims) {
    fields[dim] = Array.isArray(data[dim]) ? (data[dim] as unknown[]).length : 0;
  }
  return { answer: JSON.stringify(data, null, 2), fields };
}

// ---- 自动检查 ----

function checkRag(result: { answer: string; sources: string[] }, task: RagTask): CheckResult {
  const expectedFiles = task.expectedSources.map((s) => s.replace(".md", ""));
  const matchedSources = task.expectedSources.filter((src) =>
    result.sources.some((s) => s.includes(src.replace(".md", "")) || s.includes(src)),
  );
  const retrieval_hit = matchedSources.length > 0;
  const citation_ok = result.answer.length > 0; // 引用准确性需人工判断，这里只检查有无输出
  const task_completed = result.answer.length > 10;
  return { retrieval_hit, citation_ok, task_completed };
}

function checkAgent(
  result: { answer: string; steps: Array<{ toolName?: string }>; iterations: number },
  _task: AgentTask,
): CheckResult {
  const toolNames = result.steps.map((s) => s.toolName).filter(Boolean);
  const tool_path_ok = toolNames.length > 0; // 工具调用存在即基础通过，合理性需人工
  const constraint_ok = true; // 边界行为需人工判断
  const task_completed =
    result.answer.length > 10 && !result.answer.includes("无法") && !result.answer.includes("不能");
  return { tool_path_ok, constraint_ok, task_completed };
}

function checkReqAnalyst(
  result: { fields: Record<string, number> },
  _task: ReqAnalystTask,
): CheckResult {
  // 六维度字段完整性：每个维度至少 1 条
  const dims = Object.values(result.fields);
  const field_completeness = dims.every((n) => n > 0);
  const spec_accuracy = true; // 需人工核对规范原文
  const scenario_adaptation = true; // 需人工判断
  return {
    field_completeness,
    spec_accuracy,
    scenario_adaptation,
    task_completed: field_completeness,
  };
}

function getFailureTypes(checks: CheckResult): FailureType[] {
  const types: FailureType[] = [];
  if (checks.retrieval_hit === false) types.push("retrieval_miss");
  if (checks.citation_ok === false) types.push("citation_wrong");
  if (checks.tool_path_ok === false) types.push("tool_choice_wrong");
  if (checks.task_completed === false) types.push("task_incomplete");
  if (checks.constraint_ok === false) types.push("constraint_break");
  return types;
}

function checksAllPassed(checks: CheckResult): boolean {
  for (const [key, value] of Object.entries(checks)) {
    if (key === "notes") continue;
    if (value === false) return false;
  }
  return true;
}

// ---- 主运行逻辑 ----

export async function runEval(
  taskSetPath: string,
  type: EvalType,
  reportName: string,
  round: number,
  config: { model: string; temperature: number; maxTokens: number },
): Promise<EvalRoundReport> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const fullPath = resolve(__dirname, taskSetPath);
  const taskSet: TaskSet = JSON.parse(readFileSync(fullPath, "utf-8"));

  console.log(`\n📋 加载任务集: ${taskSet.meta.name}`);
  console.log(`   描述: ${taskSet.meta.description}`);
  console.log(`   任务数: ${taskSet.tasks.length}\n`);

  const results: EvalTaskResult[] = [];

  for (let i = 0; i < taskSet.tasks.length; i++) {
    const task = taskSet.tasks[i];
    const label = `[${i + 1}/${taskSet.tasks.length}] ${task.id}`;

    try {
      console.log(`${label} → 执行中...`);

      if (task.type === "rag") {
        const ragTask = task as RagTask;
        const output = await callRag(ragTask.question);
        const checks = checkRag(output, ragTask);
        results.push({
          taskId: task.id,
          type: "rag",
          targetProject: task.targetProject,
          question: task.question,
          checks,
          passed: checksAllPassed(checks),
          failureTypes: getFailureTypes(checks),
          actualOutput: {
            answer: output.answer.slice(0, 500),
            sources: output.sources,
          },
          notes: task.notes,
        });
        console.log(
          `   ✅ 通过: ${checksAllPassed(checks)} | sources: ${output.sources.join(", ") || "(无)"}`,
        );
      } else if (task.type === "agent") {
        const agentTask = task as AgentTask;
        const output = await callAgent(agentTask.question);
        const checks = checkAgent(output, agentTask);
        results.push({
          taskId: task.id,
          type: "agent",
          targetProject: task.targetProject,
          question: task.question,
          checks,
          passed: checksAllPassed(checks),
          failureTypes: getFailureTypes(checks),
          actualOutput: {
            answer: output.answer.slice(0, 500),
            toolSteps: output.steps.map((s) => ({
              toolName: s.toolName ?? "unknown",
              toolArgs: s.toolArgs ?? {},
              success: !s.error,
              errorMessage: s.error,
            })),
            iterations: output.iterations,
          },
          notes: task.notes,
        });
        const toolSeq = output.steps
          .map((s) => s.toolName)
          .filter(Boolean)
          .join(" → ");
        console.log(
          `   ✅ 通过: ${checksAllPassed(checks)} | ${output.iterations} 轮 | 工具: ${toolSeq || "(无)"}`,
        );
      } else if (task.type === "req-analyst") {
        const reqTask = task as ReqAnalystTask;
        const output = await callReqAnalyst(reqTask.question);
        const checks = checkReqAnalyst(output, reqTask);
        results.push({
          taskId: task.id,
          type: "req-analyst",
          targetProject: task.targetProject,
          question: task.question,
          checks,
          passed: checksAllPassed(checks),
          failureTypes: getFailureTypes(checks),
          actualOutput: {
            answer: output.answer.slice(0, 500),
          },
          notes: task.notes,
        });
        const fieldInfo = Object.entries(output.fields)
          .map(([k, v]) => `${k}:${v}`)
          .join(", ");
        console.log(`   ✅ 通过: ${checksAllPassed(checks)} | 维度条目: ${fieldInfo}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ 错误: ${message}`);
      results.push({
        taskId: task.id,
        type: task.type,
        targetProject: task.targetProject,
        question: task.question,
        checks: { task_completed: false },
        passed: false,
        failureTypes: ["task_incomplete"],
        actualOutput: {},
        notes: `执行错误: ${message}`,
      });
    }
  }

  // 汇总统计
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;

  const byDifficulty = { simple: { t: 0, p: 0 }, medium: { t: 0, p: 0 }, hard: { t: 0, p: 0 } };
  for (let i = 0; i < results.length; i++) {
    const task = taskSet.tasks[i];
    const r = results[i];
    const d = task.difficulty as keyof typeof byDifficulty;
    byDifficulty[d].t++;
    if (r.passed) byDifficulty[d].p++;
  }

  const byFailureType: Record<string, number> = {
    retrieval_miss: 0,
    citation_wrong: 0,
    tool_choice_wrong: 0,
    task_incomplete: 0,
    constraint_break: 0,
  };
  for (const r of results) {
    for (const ft of r.failureTypes) {
      byFailureType[ft]++;
    }
  }

  // 维度统计
  const dimKeys = [
    "retrieval_hit",
    "citation_ok",
    "task_completed",
    "tool_path_ok",
    "constraint_ok",
    "field_completeness",
    "spec_accuracy",
    "scenario_adaptation",
  ] as const;

  const byDimension: Record<string, { total: number; passed: number; rate: number }> = {};
  for (const key of dimKeys) {
    const applicable = results.filter((r) => r.checks[key as keyof CheckResult] !== undefined);
    if (applicable.length > 0) {
      const p = applicable.filter((r) => r.checks[key as keyof CheckResult] === true).length;
      byDimension[key] = {
        total: applicable.length,
        passed: p,
        rate: Math.round((p / applicable.length) * 1000) / 10,
      };
    }
  }

  const report: EvalRoundReport = {
    meta: {
      name: reportName,
      date: new Date().toISOString().split("T")[0],
      round,
      config,
    },
    results,
    summary: {
      total,
      passed,
      passRate,
      byDimension,
      byFailureType: byFailureType as Record<FailureType, number>,
      byDifficulty: {
        simple: {
          total: byDifficulty.simple.t,
          passed: byDifficulty.simple.p,
          rate:
            byDifficulty.simple.t > 0
              ? Math.round((byDifficulty.simple.p / byDifficulty.simple.t) * 1000) / 10
              : 0,
        },
        medium: {
          total: byDifficulty.medium.t,
          passed: byDifficulty.medium.p,
          rate:
            byDifficulty.medium.t > 0
              ? Math.round((byDifficulty.medium.p / byDifficulty.medium.t) * 1000) / 10
              : 0,
        },
        hard: {
          total: byDifficulty.hard.t,
          passed: byDifficulty.hard.p,
          rate:
            byDifficulty.hard.t > 0
              ? Math.round((byDifficulty.hard.p / byDifficulty.hard.t) * 1000) / 10
              : 0,
        },
      },
    },
  };

  // 输出
  const outDir = resolve(__dirname, OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });

  const jsonPath = resolve(outDir, `${reportName.replace(/\s+/g, "-").toLowerCase()}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n📄 结果已保存: ${jsonPath}`);

  // 打印摘要
  console.log(`\n===== 评估摘要 =====`);
  console.log(`通过率: ${passed}/${total} (${passRate}%)`);
  console.log(
    `按难度: simple=${byDifficulty.simple.p}/${byDifficulty.simple.t} medium=${byDifficulty.medium.p}/${byDifficulty.medium.t} hard=${byDifficulty.hard.p}/${byDifficulty.hard.t}`,
  );
  console.log(`按维度:`, JSON.stringify(byDimension));
  console.log(`失败分布:`, JSON.stringify(byFailureType));

  return report;
}
