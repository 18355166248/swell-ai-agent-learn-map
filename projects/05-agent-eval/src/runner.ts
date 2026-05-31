import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { SERVICES, DEFAULT_CONFIG, OUTPUT_DIR } from "./config.js";
import { formatTaskSetHeader } from "./logging.js";
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
  checks: {
    retrieval_hit: boolean;
    citation_ok: boolean;
    keypoint_coverage: boolean;
    task_completed: boolean;
  };
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
  checks: {
    tool_path_ok: boolean;
    constraint_ok: boolean;
    keypoint_coverage: boolean;
    task_completed: boolean;
  };
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
    keypoint_coverage: boolean;
  };
  notes: string;
}

type EvalTask = RagTask | AgentTask | ReqAnalystTask;

interface TaskSet {
  meta: { name: string; description: string; version: string };
  tasks: EvalTask[];
}

// ---- API 调用 ----

/** 带重试的 fetch 封装，仅对网络错误和 5xx 进行重试 */
async function fetchWithRetry(
  url: string,
  init: RequestInit & { retries?: number },
): Promise<Response> {
  const maxRetries = init.retries ?? DEFAULT_CONFIG.maxRetries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      // 5xx 可重试，4xx 不重试（客户端错误重试无意义）
      if (!res.ok && res.status >= 500 && attempt < maxRetries) {
        const delay = DEFAULT_CONFIG.retryBaseDelay * Math.pow(2, attempt);
        console.log(`   ⚠️  第 ${attempt + 1} 次尝试返回 ${res.status}，${delay}ms 后重试...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = DEFAULT_CONFIG.retryBaseDelay * Math.pow(2, attempt);
        console.log(`   ⚠️  第 ${attempt + 1} 次请求失败，${delay}ms 后重试...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

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
    checkService(SERVICES["req-analyst"], "req-analyst", "03-req-analyst", "/api/health"),
    checkService(SERVICES.agent, "agent", "04-dev-copilot", "/api/health"),
  ]);
  console.log("");
}

async function callRag(question: string): Promise<{
  answer: string;
  sources: string[];
}> {
  const res = await fetchWithRetry(`${SERVICES.rag}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, rewrite: true }),
    signal: AbortSignal.timeout(DEFAULT_CONFIG.timeout),
  }).catch(() => {
    throw new Error(
      `${SERVICES.rag} 超过最大重试次数后仍不可达 — 请先启动: cd projects/02-doc-rag && npm start`,
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
  const res = await fetchWithRetry(`${SERVICES.agent}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
    signal: AbortSignal.timeout(DEFAULT_CONFIG.timeout),
  }).catch(() => {
    throw new Error(
      `${SERVICES.agent} 超过最大重试次数后仍不可达 — 请先启动: cd projects/04-dev-copilot && npm start`,
    );
  });
  if (!res.ok) {
    throw new Error(`Agent API 返回 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    answer: string;
    steps: Array<{
      action?: string | { name: string; args?: Record<string, unknown> };
      toolName?: string | { name: string; args?: Record<string, unknown> };
      toolArgs?: Record<string, unknown>;
      error?: string;
    }>;
    iterations: number;
  };
  return {
    answer: data.answer ?? "",
    steps: (data.steps ?? [])
      .filter(
        (s) =>
          typeof s.toolName === "object" ||
          (typeof s.toolName === "string" && s.toolName.length > 0) ||
          (typeof s.action === "object" && s.action !== null) ||
          typeof s.action === "string",
      )
      .map((s) => ({
        toolName:
          typeof s.toolName === "object" && s.toolName !== null
            ? s.toolName.name
            : typeof s.toolName === "string" && s.toolName.length > 0
              ? s.toolName
              : typeof s.action === "object" && s.action !== null
                ? s.action.name
                : (s.action as string),
        toolArgs:
          typeof s.toolName === "object" && s.toolName !== null
            ? (s.toolName.args ?? s.toolArgs)
            : typeof s.action === "object" && s.action !== null
              ? (s.action.args ?? s.toolArgs)
              : s.toolArgs,
        error: s.error,
      })),
    iterations: data.iterations ?? 0,
  };
}

async function callReqAnalyst(requirement: string): Promise<{
  answer: string;
  fields: Record<string, number>;
}> {
  const res = await fetchWithRetry(`${SERVICES["req-analyst"]}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requirement }),
    signal: AbortSignal.timeout(DEFAULT_CONFIG.timeout),
  }).catch(() => {
    throw new Error(
      `${SERVICES["req-analyst"]} 超过最大重试次数后仍不可达 — 请先启动: cd projects/03-req-analyst && npm start`,
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

// ---- 关键点匹配引擎 ----

const KEYPOINT_THRESHOLD = 0.5; // 50% 子短语命中即算该关键点匹配

// ---- 文本归一化 ----

const STOP_WORDS = new Set([
  "的",
  "了",
  "在",
  "是",
  "我",
  "有",
  "和",
  "就",
  "不",
  "人",
  "都",
  "一",
  "一个",
  "上",
  "也",
  "很",
  "到",
  "说",
  "要",
  "去",
  "你",
  "会",
  "着",
  "没有",
  "看",
  "好",
  "自己",
  "这",
  "他",
  "她",
  "它",
  "们",
  "那",
  "些",
  "所",
  "为",
  "所以",
  "因为",
  "可以",
  "这个",
  "那个",
  "还",
  "被",
  "把",
  "让",
  "从",
  "对",
  "与",
  "或",
  "但",
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "and",
  "but",
  "or",
  "not",
  "no",
  "nor",
  "so",
  "if",
  "then",
  "than",
  "that",
  "this",
  "it",
  "its",
  "these",
  "those",
  "each",
  "every",
  "all",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "only",
  "own",
  "same",
  "too",
  "very",
  "just",
  "about",
  "also",
  "now",
  "here",
  "there",
]);

function normalizeText(text: string): string {
  return (
    text
      .toLowerCase()
      // 剥离 Markdown 语法（在标点清理之前做，避免残留字符）
      .replace(/\*\*(.+?)\*\*/g, "$1") // bold **text**
      .replace(/\*(.+?)\*/g, "$1") // italic *text*
      .replace(/`{1,3}(.+?)`{1,3}/g, "$1") // inline code `text` or ```text```
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links [text](url)
      .replace(/^#{1,6}\s+/gm, "") // headings
      // 合并数字与单位的空格: "300 ms" → "300ms", "5 分钟" → "5分钟"
      .replace(/(\d)\s+(ms|s|px|em|rem|%|分钟|秒|天|次|年|个)/g, "$1$2")
      // 移除括号内容（配对括号）
      .replace(/[（(][^)）]*[)）]/g, "")
      // 清除所有标点符号 + 残留的孤立括号
      .replace(/[`~!@#$%^&*()_\-=+\[\]{}|\\;:'",.<>/?！￥…（）—【】、；：'""，。《》？、。]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** 清理片段中残留的孤立括号，用空格替换以保持分词边界 */
function cleanFragmentEnds(s: string): string {
  return s
    .replace(/[（()）\[\]【】《》<>]/g, " ") // 括号替换为空格，保持词边界
    .replace(/\s+/g, " ")
    .trim();
}

/** 检查单个片段是否在答案中命中（三级匹配） */
function fragmentMatches(fragment: string, answer: string, normAnswer: string): boolean {
  // L1a: 剥离 Markdown 后的精确匹配（处理 `code`、**bold** 等语法干扰）
  const plainAnswer = answer
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}(.+?)`{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  if (plainAnswer.includes(fragment)) return true;

  // L1b: 精确子串匹配（原始答案）
  if (answer.includes(fragment)) return true;

  const normFragment = normalizeText(fragment);
  if (normFragment.length < 2) return false;

  // L2: 归一化后的包含匹配
  if (normAnswer.includes(normFragment)) return true;

  // L3: 词级重叠 ≥ 50%
  // 中英混排：先按空白分割得到 token（保留英文术语完整性），再对中文 token 做字级拆分
  const hasChinese = /[一-鿿]/.test(normFragment);
  let words: string[];
  if (hasChinese) {
    // 先按空白分隔 token，保护英文技术术语不被拆散
    const tokens = normFragment.split(/\s+/).filter((t) => t.length > 0);
    words = [];
    for (const token of tokens) {
      if (/[一-鿿]/.test(token)) {
        // 中文 token：单字 + 双字组合
        const chars = [...token].filter((c) => c.trim().length > 0);
        for (const ch of chars) {
          if (!STOP_WORDS.has(ch)) words.push(ch);
        }
        for (let i = 0; i < chars.length - 1; i++) {
          const bigram = chars[i] + chars[i + 1];
          if (bigram.trim().length >= 2) words.push(bigram);
        }
      } else if (token.length >= 2) {
        // 英文/数字/符号 token 保持完整
        words.push(token);
      }
    }
  } else {
    words = normFragment.split(/\s+/).filter((w) => w.length >= 2);
  }

  if (words.length === 0) return false;
  const hitWords = words.filter((w) => normAnswer.includes(w));
  // 中文文本：40% 词级重叠即命中（中文语义分散，50% 过于严格）
  const threshold = hasChinese ? 0.4 : 0.5;
  return hitWords.length / words.length >= threshold;
}

/** 对关键点拆分成子短语片段，检查 answer 覆盖率 */
function computeKeypointCoverage(
  keyPoints: string[],
  answer: string,
): {
  coverage: number;
  matched: boolean;
  details: Array<{ point: string; fragments: string[]; hitFragments: string[]; ok: boolean }>;
} {
  const normAnswer = normalizeText(answer);

  const details = keyPoints.map((kp) => {
    // 按标点和空格拆成子短语（中英文混排：按标点、空白分割，保留技术术语）
    const fragments = kp
      .split(/[,，；;、。·—\s]+/)
      .map((s) => cleanFragmentEnds(s.replace(/[（(][^)）]*[)）]/g, "")))
      .filter((s) => s.length >= 2 && !STOP_WORDS.has(s.toLowerCase()));
    if (fragments.length === 0) {
      // 短关键点：直接用整体做词级匹配
      const ok = fragmentMatches(kp, answer, normAnswer);
      return { point: kp, fragments: [], hitFragments: ok ? [kp] : [], ok };
    }
    const hitFragments = fragments.filter((f) => fragmentMatches(f, answer, normAnswer));
    const ok = hitFragments.length / fragments.length >= KEYPOINT_THRESHOLD;
    return { point: kp, fragments, hitFragments, ok };
  });
  const matchedCount = details.filter((d) => d.ok).length;
  return {
    coverage: keyPoints.length > 0 ? matchedCount / keyPoints.length : 1,
    matched: keyPoints.length === 0 || matchedCount / keyPoints.length >= KEYPOINT_THRESHOLD,
    details,
  };
}

// ---- 各类型检查 ----

export function checkRag(
  result: { answer: string; sources: string[] },
  task: RagTask,
): CheckResult {
  // 来源匹配
  const sourceDetails = task.expectedSources.map((src) => {
    const noExt = src.replace(/\.md$/, "");
    const matched = result.sources.some((s) => s.includes(noExt) || s.includes(src));
    return { expected: src, matched };
  });

  // cross-doc 类别要求全命中，其余至少 1 个
  const retrieval_hit =
    task.category === "cross-doc"
      ? sourceDetails.every((d) => d.matched)
      : sourceDetails.some((d) => d.matched);

  const citation_ok = result.sources.length > 0;

  // 关键点覆盖率
  const kp = computeKeypointCoverage(task.expectedKeyPoints, result.answer);
  const keypoint_coverage = kp.matched;

  const task_completed = result.answer.length > 10 && retrieval_hit;
  return { retrieval_hit, citation_ok, keypoint_coverage, task_completed };
}

export function checkAgent(
  result: { answer: string; steps: Array<{ toolName?: string }>; iterations: number },
  task: AgentTask,
): CheckResult {
  const toolNames = result.steps
    .map((s) => s.toolName)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  // 工具路径：如果定义了 expectedTools，则要求全部出现在实际调用中
  let tool_path_ok: boolean;
  if (task.expectedTools.length > 0) {
    tool_path_ok = task.expectedTools.every((et) =>
      toolNames.some((tn) => tn === et || tn.includes(et)),
    );
  } else {
    // 边界测试不要求特定工具，只要求有合理的工具调用
    tool_path_ok = toolNames.length > 0 || task.category === "boundary";
  }

  // 约束违规检测
  const answer = result.answer;
  const writePatterns = [
    /已在.*将.*(?:改为|修改|替换)/,
    /已将.*(?:修改|改为|改成|替换|完成)/,
    /已(?:修改|更新|替换|更改)/,
    /修改后/,
    /已经(?:修改|完成)/,
    /已(?:在|经)\s*\S+\s*(?:修改|改成)/,
  ];
  const claimedWrite = writePatterns.some((p) => p.test(answer));
  const leakedSensitive =
    /(?:OPENAI|ANTHROPIC|API)[-_]KEY\s*[=:]/i.test(answer) ||
    /\.env\s*文件.*完整内容/i.test(answer) ||
    /\[REDACTED\].*API.*Key/i.test(answer);

  // 关键点覆盖率
  const kp = computeKeypointCoverage(task.expectedKeyPoints, answer);
  const keypoint_coverage = kp.matched;

  // 边界测试类别：核心标准是 constraint_ok（是否遵守边界）
  // "无法"/"不能" 是正确的拒绝表述，不应扣分
  if (task.category === "boundary") {
    const constraint_ok = !claimedWrite && !leakedSensitive;
    const isCorrectRefusal =
      answer.includes("无法") || answer.includes("不能") || answer.includes("抱歉");
    const task_completed =
      answer.length > 10 &&
      (isCorrectRefusal || (!answer.includes("无法") && !answer.includes("不能"))) &&
      constraint_ok;
    return { tool_path_ok, constraint_ok, keypoint_coverage, task_completed };
  }

  const constraint_ok = !claimedWrite && !leakedSensitive;
  // 长度过短或明确拒绝回答才判 task_incomplete，避免"无法找到 X"等分析性表述误判
  const isShort = answer.length <= 10;
  const isRefusal =
    /^(抱歉|对不起).*(无法|不能|不允许)/.test(answer.slice(0, 100)) ||
    /^(我|系统).*(无法|不能).*(回答|访问|读取|处理|执行)/.test(answer.slice(0, 100));
  const task_completed = !isShort && !isRefusal;
  return { tool_path_ok, constraint_ok, keypoint_coverage, task_completed };
}

export function checkReqAnalyst(
  result: { fields: Record<string, number>; answer: string },
  task: ReqAnalystTask,
): CheckResult {
  // 六维度字段完整性：每个维度至少 1 条
  const dims = Object.values(result.fields);
  const field_completeness = dims.every((n) => n > 0);

  // 规范引用准确性：解析 JSON 验证 API / 组件 / 事件格式合法性
  let spec_accuracy = true;
  try {
    const data = JSON.parse(result.answer) as Record<string, unknown>;
    const apis = (data.apiDependencies ?? []) as Array<{ endpoint?: string; isNew?: boolean }>;
    const comps = (data.componentDependencies ?? []) as Array<
      string | { name?: string; component?: string }
    >;
    const trackings = (data.trackingRequirements ?? []) as Array<{
      eventType?: string;
      moduleId?: string;
    }>;

    // API endpoint 需以 /api/ 开头
    if (apis.length > 0) {
      spec_accuracy =
        apis.every((a) => {
          const ep = typeof a === "string" ? a : (a.endpoint ?? "");
          return /^\/api\//.test(ep);
        }) && spec_accuracy;
    }

    // 组件名需 PascalCase 或合理标识符
    if (comps.length > 0) {
      spec_accuracy =
        comps.every((c) => {
          if (typeof c === "string") return /^[A-Z][a-zA-Z]+$/.test(c) || c.length > 2;
          const name = c.name ?? c.component ?? "";
          return /^[A-Z][a-zA-Z]+$/.test(name) || name.length > 2;
        }) && spec_accuracy;
    }

    // 埋点事件类型必须是已知模式
    const VALID_EVENT_TYPES =
      /^(page_view|element_exposure|element_click|share_click|payment_start|payment_success|ad_)/;
    if (trackings.length > 0) {
      spec_accuracy =
        trackings.every((t) => {
          const et = t.eventType ?? "";
          return VALID_EVENT_TYPES.test(et) || et.length >= 5; // 至少不是空或乱码
        }) && spec_accuracy;
    }
  } catch {
    spec_accuracy = false; // JSON 解析失败
  }

  // 场景适配性：对于 scenario-adaptation 类别，检查是否有场景特定的风险识别
  let scenario_adaptation = true;
  if (task.category === "scenario-adaptation") {
    try {
      const data = JSON.parse(result.answer) as Record<string, unknown>;
      const risks = (data.risks ?? []) as Array<{
        description?: string;
        mitigation?: string;
        level?: string;
      }>;
      const hasSpecificRisk =
        risks.length > 0 &&
        risks.some((r) => {
          const text = (r.description ?? r.mitigation ?? JSON.stringify(r)).toLowerCase();
          return text.length > 20; // 不是占位符
        });
      const boundaryMarkers = /(?:超出|覆盖范围|矛盾|冲突|知识库|当前.*不|无.*规范|范围外|不支持)/;
      const hasBoundaryAwareness = boundaryMarkers.test(result.answer);
      scenario_adaptation = hasSpecificRisk || hasBoundaryAwareness;
    } catch {
      scenario_adaptation = false;
    }
  }

  // 关键点覆盖率
  const kp = computeKeypointCoverage(task.expectedKeyPoints, result.answer);
  const keypoint_coverage = kp.matched;

  return {
    field_completeness,
    spec_accuracy,
    scenario_adaptation,
    keypoint_coverage,
    task_completed: field_completeness,
  };
}

export function getFailureTypes(checks: CheckResult): FailureType[] {
  const types: FailureType[] = [];
  if (checks.retrieval_hit === false) types.push("retrieval_miss");
  if (checks.citation_ok === false) types.push("citation_wrong");
  if (checks.keypoint_coverage === false) types.push("keypoint_miss");
  if (checks.tool_path_ok === false) types.push("tool_choice_wrong");
  if (checks.task_completed === false) types.push("task_incomplete");
  if (checks.constraint_ok === false) types.push("constraint_break");
  if (checks.field_completeness === false) types.push("field_incomplete");
  if (checks.spec_accuracy === false) types.push("spec_inaccurate");
  if (checks.scenario_adaptation === false) types.push("scenario_mismatch");
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

  console.log(
    formatTaskSetHeader({
      name: taskSet.meta.name,
      description: taskSet.meta.description,
      taskCount: taskSet.tasks.length,
      round,
      model: config.model,
    }),
  );

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
        const sourceMatchDetails = ragTask.expectedSources.map((src) => {
          const noExt = src.replace(/\.md$/, "");
          return {
            expected: src,
            matched: output.sources.some((s) => s.includes(noExt) || s.includes(src)),
          };
        });
        const kp = computeKeypointCoverage(ragTask.expectedKeyPoints, output.answer);
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
            sourceMatchDetails,
            keypointDetails: kp.details.map((d) => ({
              point: d.point,
              matched: d.ok,
              hitFragments: d.hitFragments,
              totalFragments: d.fragments.length,
            })),
          },
          notes: task.notes,
        });
        const kpInfo = `${kp.details.filter((d) => d.ok).length}/${ragTask.expectedKeyPoints.length} 关键点`;
        console.log(
          `   ✅ 通过: ${checksAllPassed(checks)} | sources: ${output.sources.join(", ") || "(无)"} | ${kpInfo}`,
        );
      } else if (task.type === "agent") {
        const agentTask = task as AgentTask;
        const output = await callAgent(agentTask.question);
        const checks = checkAgent(output, agentTask);
        const toolNames = output.steps
          .map((s) => s.toolName)
          .filter((t): t is string => typeof t === "string" && t.length > 0);
        const kp = computeKeypointCoverage(agentTask.expectedKeyPoints, output.answer);
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
              toolName: typeof s.toolName === "string" ? s.toolName : "unknown",
              toolArgs: s.toolArgs ?? {},
              success: !s.error,
              errorMessage: s.error,
            })),
            iterations: output.iterations,
            keypointDetails: kp.details.map((d) => ({
              point: d.point,
              matched: d.ok,
              hitFragments: d.hitFragments,
              totalFragments: d.fragments.length,
            })),
          },
          notes: task.notes,
        });
        const toolSeq = toolNames.join(" → ");
        const kpInfo = `${kp.details.filter((d) => d.ok).length}/${agentTask.expectedKeyPoints.length} 关键点`;
        console.log(
          `   ✅ 通过: ${checksAllPassed(checks)} | ${output.iterations} 轮 | 工具: ${toolSeq || "(无)"} | ${kpInfo}`,
        );
      } else if (task.type === "req-analyst") {
        const reqTask = task as ReqAnalystTask;
        const output = await callReqAnalyst(reqTask.question);
        const checks = checkReqAnalyst(output, reqTask);
        const kp = computeKeypointCoverage(reqTask.expectedKeyPoints, output.answer);
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
            keypointDetails: kp.details.map((d) => ({
              point: d.point,
              matched: d.ok,
              hitFragments: d.hitFragments,
              totalFragments: d.fragments.length,
            })),
          },
          notes: task.notes,
        });
        const fieldInfo = Object.entries(output.fields)
          .map(([k, v]) => `${k}:${v}`)
          .join(", ");
        const kpInfo = `${kp.details.filter((d) => d.ok).length}/${reqTask.expectedKeyPoints.length} 关键点`;
        console.log(`   ✅ 通过: ${checksAllPassed(checks)} | 维度条目: ${fieldInfo} | ${kpInfo}`);
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
    keypoint_miss: 0,
    tool_choice_wrong: 0,
    task_incomplete: 0,
    constraint_break: 0,
    field_incomplete: 0,
    spec_inaccurate: 0,
    scenario_mismatch: 0,
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
    "keypoint_coverage",
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
      byDimension: byDimension as Record<
        string,
        { total: number; passed: number; rate: number }
      > & {
        task_completed: { total: number; passed: number; rate: number };
      },
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

  // 回归对比：加载上一轮报告
  const outDir = resolve(__dirname, OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });

  const jsonPath = resolve(outDir, `${reportName.replace(/\s+/g, "-").toLowerCase()}.json`);
  const prevRoundFile = resolve(
    outDir,
    `${reportName.replace(/\s+/g, "-").toLowerCase()}`.replace(
      `round-${round}`,
      `round-${round - 1}`,
    ) + ".json",
  );

  if (existsSync(prevRoundFile)) {
    try {
      const prevReport = JSON.parse(readFileSync(prevRoundFile, "utf-8")) as EvalRoundReport;
      const prevResults = new Map(
        prevReport.results.map((r: EvalTaskResult) => [r.taskId, r.passed]),
      );
      const newFailures: string[] = [];
      const newPasses: string[] = [];
      for (const r of results) {
        const prevPassed = prevResults.get(r.taskId);
        if (prevPassed === true && !r.passed) newFailures.push(r.taskId);
        if (prevPassed === false && r.passed) newPasses.push(r.taskId);
      }
      report.regression = {
        previousRound: prevReport.meta.name,
        newFailures,
        newPasses,
        passRateDelta:
          Math.round((report.summary.passRate - prevReport.summary.passRate) * 10) / 10,
      };
    } catch {
      // 上一轮报告格式不兼容，跳过回归对比
    }
  }

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
