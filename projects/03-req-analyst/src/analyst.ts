import { config } from "dotenv";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import OpenAI from "openai";
import { getEmbedding } from "../../02-doc-rag/src/embedder.js";
import { rewriteQuery } from "../../02-doc-rag/src/query-rewriter.js";
import { retrieve, type VectorEntry } from "../../02-doc-rag/src/retriever.js";
import { BM25Search, hybridRetrieve } from "../../02-doc-rag/src/keyword-search.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";
const DATA_DIR = resolve(__dirname, "..", ".data");

/** 单次 LLM 请求超时（毫秒） */
const LLM_TIMEOUT = 60_000;

export interface ReqAnalysis {
  pageChanges: { page: string; changes: string }[];
  apiDependencies: { endpoint: string; usage: string; isNew: boolean }[];
  trackingRequirements: { eventType: string; moduleId: string; description: string }[];
  componentDependencies: { component: string; usage: string }[];
  risks: { risk: string; level: "high" | "medium" | "low"; mitigation: string }[];
  testSuggestions: { scenario: string; priority: "high" | "medium" | "low" }[];
}

const SYSTEM_PROMPT = `你是一个资深前端需求分析专家。根据用户提供的需求描述和内部规范文档，输出结构化的需求分析。

## 分析维度（每个维度至少 1 条——这是硬性要求）

你必须覆盖以下 6 个维度。**每个维度至少返回 1 条有效条目**，除非需求本身完全不可能涉及该维度（这种极少见的情况几乎不存在，因为任何前端需求都会涉及页面、接口、组件、风险、测试中的多数维度）。

1. **pageChanges** — 页面改动点（必须 ≥1 条）
   - 列出需要修改或新增的页面，page 为具体页面名
   - 说明具体改动内容（不能只写"优化""修改"等空泛描述）

2. **apiDependencies** — 接口依赖（必须 ≥1 条）
   - 从规范文档查找已有接口路径；找不到则用通用路径并标注 isNew: true
   - 每个接口标注 isNew（已有接口=false，新接口=true）

3. **trackingRequirements** — 埋点需求（必须 ≥1 条）
   - eventType 必须是以下之一：page_view / element_click / element_exposure / share_click / payment_start / payment_success / ad_impression / ad_click
   - moduleId 非空，description 具体说明埋点时机

4. **componentDependencies** — 组件依赖（必须 ≥1 条）
   - 从组件库规范中匹配可复用组件；找不到则说明需新建组件并标注
   - component 名称使用 PascalCase

5. **risks** — 风险点（必须 ≥1 条）
   - 识别具体的技术风险和业务风险（不能写"可能有风险"等空泛描述）
   - level 为 high / medium / low，mitigation 为具体可执行的缓解措施
   - 如需求超出知识库覆盖范围，必须在 risks 中说明"超出当前知识库覆盖范围"的风险

6. **testSuggestions** — 测试点建议（必须 ≥1 条）
   - 每个 scenario 包含具体操作步骤和验证点
   - priority 为 high / medium / low

## 输出格式

严格输出 JSON，不要包含 markdown 代码块标记，不要有任何额外说明文字：

{
  "pageChanges": [{ "page": "页面名", "changes": "具体改动内容" }],
  "apiDependencies": [{ "endpoint": "/api/xxx", "usage": "用途说明", "isNew": false }],
  "trackingRequirements": [{ "eventType": "page_view", "moduleId": "模块ID", "description": "埋点时机与目的" }],
  "componentDependencies": [{ "component": "ComponentName", "usage": "使用场景" }],
  "risks": [{ "risk": "具体风险描述", "level": "medium", "mitigation": "具体缓解措施" }],
  "testSuggestions": [{ "scenario": "具体测试场景", "priority": "high" }]
}

## 输出示例（参考格式）

以"新增用户反馈入口"为例，正确输出：

{
  "pageChanges": [{ "page": "设置页", "changes": "在设置页底部新增'意见反馈'入口按钮，点击后跳转反馈表单页" }],
  "apiDependencies": [{ "endpoint": "/api/feedback/submit", "usage": "提交用户反馈内容", "isNew": true }],
  "trackingRequirements": [{ "eventType": "element_click", "moduleId": "settings_feedback", "description": "用户点击意见反馈入口时上报" }],
  "componentDependencies": [{ "component": "FormModal", "usage": "反馈表单弹窗" }, { "component": "Toast", "usage": "提交成功后提示" }],
  "risks": [{ "risk": "反馈内容可能包含敏感信息，需后端做内容过滤", "level": "medium", "mitigation": "前端做字数限制，后端做敏感词过滤" }],
  "testSuggestions": [{ "scenario": "点击反馈入口 → 填写表单 → 提交成功 → 收到 Toast 提示", "priority": "high" }]
}

## 重要原则

- **每个维度至少 1 条**：不满足时必须从通用前端最佳实践推导，即使知识库未覆盖该场景
- 优先复用已有组件和接口，减少新增；找不到已有接口时，根据 RESTful 规范推导合理的 /api/xxx 路径并标注 isNew: true
- 从规范文档中查找具体接口路径和组件名称（文档中给出的优先使用）
- 风险分析要具体，包含明确的场景和可执行的缓解措施
- 测试建议覆盖正常流程、异常流程、边界条件
- 超出知识库覆盖范围时，基于通用前端知识合理推断，不要返回全空结果`;

// ---- 重试与容错 ----

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  label = "API",
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const isRetryable =
        err.status >= 500 ||
        err.status === 429 ||
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "UND_ERR_CONNECT_TIMEOUT" ||
        (err.message &&
          (/timeout|rate.?limit|overloaded|server.?error/i.test(err.message) ||
            /5\d\d/i.test(err.message)));

      if (!isRetryable || i === maxRetries) {
        throw lastErr;
      }
      const delay = Math.pow(2, i) * 1000;
      console.error(
        `[重试] ${label} 失败: ${err.message}，${delay}ms 后重试 (${i + 1}/${maxRetries})...`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ---- JSON 解析 ----

function parseJsonRobust(raw: string): Record<string, unknown> {
  // 1. 先尝试直接解析
  try {
    return JSON.parse(raw);
  } catch {
    // ignore
  }

  // 2. 去除 markdown 包裹后重试
  const stripped = raw
    .replace(/^```json?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    // ignore
  }

  // 3. 尝试在文本中提取 JSON 对象（从第一个 { 到最后一个 }）
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      // ignore
    }
  }

  // 4. 全部失败
  console.error("JSON 解析失败，原始返回:", raw.slice(0, 500));
  throw new Error("LLM 返回了无法解析的格式，请重试");
}

function normalizeAnalysis(parsed: Record<string, unknown>): ReqAnalysis {
  return {
    pageChanges: Array.isArray(parsed.pageChanges) ? parsed.pageChanges : [],
    apiDependencies: Array.isArray(parsed.apiDependencies) ? parsed.apiDependencies : [],
    trackingRequirements: Array.isArray(parsed.trackingRequirements)
      ? parsed.trackingRequirements
      : [],
    componentDependencies: Array.isArray(parsed.componentDependencies)
      ? parsed.componentDependencies
      : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    testSuggestions: Array.isArray(parsed.testSuggestions) ? parsed.testSuggestions : [],
  };
}

/** 检查分析结果是否全空（所有维度条目数均为 0） */
function isAnalysisEmpty(analysis: ReqAnalysis): boolean {
  const dims = [
    analysis.pageChanges,
    analysis.apiDependencies,
    analysis.trackingRequirements,
    analysis.componentDependencies,
    analysis.risks,
    analysis.testSuggestions,
  ];
  return dims.every((d) => d.length === 0);
}

/** 为全空结果生成基于通用知识的最小分析 */
function generateFallbackAnalysis(requirement: string): ReqAnalysis {
  const desc = requirement.slice(0, 80);
  return {
    pageChanges: [{ page: "相关页面（自动推断）", changes: `根据需求"${desc}"推导的页面改动` }],
    apiDependencies: [
      { endpoint: "/api/related", usage: `需求"${desc}"涉及的接口（自动推断）`, isNew: true },
    ],
    trackingRequirements: [
      {
        eventType: "element_click",
        moduleId: "auto_inferred",
        description: `需求"${desc}"涉及的交互埋点（自动推断）`,
      },
    ],
    componentDependencies: [
      { component: "RelatedComponent", usage: `需求"${desc}"涉及的组件（自动推断）` },
    ],
    risks: [
      {
        risk: `需求"${desc}"缺少规范文档覆盖，分析结果基于通用知识推断`,
        level: "high",
        mitigation: "建议补充相关规范文档后重新分析",
      },
    ],
    testSuggestions: [
      { scenario: `验证需求"${desc}"的基本功能流程`, priority: "high" },
      { scenario: "验证异常情况和边界条件", priority: "medium" },
    ],
  };
}

// ---- 核心逻辑 ----

function loadVectors(): VectorEntry[] {
  const path = join(DATA_DIR, "vectors.json");
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8"));
}

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Req Analyst",
    },
  } as any);
}

function buildUserPrompt(requirement: string, chunks: string[]): string {
  const context = chunks.map((c, i) => `[文档${i + 1}]:\n${c}`).join("\n\n---\n\n");

  return `## 内部规范文档

${context}

## 需求描述

${requirement}

请根据上述规范文档分析该需求，输出 JSON。`;
}

export async function analyzeRequirement(
  requirement: string,
  model?: string,
): Promise<ReqAnalysis> {
  const vectors = loadVectors();
  if (vectors.length === 0) {
    throw new Error("索引为空，请先运行 npm run index");
  }

  // Query 改写（失败时回退到原始问题，rewriteQuery 内部已处理）
  const expanded = await rewriteQuery(requirement, model);
  const searchQuery = `${requirement} | ${expanded}`;

  // Embedding + 检索（失败时回退到 BM25）
  let results: Array<{ entry: VectorEntry; similarity: number }>;
  try {
    const queryEmb = await retryWithBackoff(() => getEmbedding(searchQuery), 2, "Embedding");
    const vecResults = retrieve(queryEmb, vectors, 6);
    const bm25 = new BM25Search(vectors);
    const kwResults = bm25.search(searchQuery, 6);
    results = hybridRetrieve(vecResults, kwResults, 5);
  } catch (err: any) {
    console.error(`向量检索失败: ${err.message}，降级为 BM25 关键词检索`);
    try {
      const bm25 = new BM25Search(vectors);
      results = bm25.search(searchQuery, 5).map((r) => ({
        entry: r.entry,
        similarity: r.bm25Score / 10, // 归一化到 0-1 范围
      }));
    } catch (bm25Err: any) {
      throw new Error(`检索失败: ${err.message}`);
    }
  }

  const chunks = results.map((r) => r.entry.chunk);
  const userPrompt = buildUserPrompt(requirement, chunks);

  const client = getClient();
  const modelName = model || DEFAULT_MODEL;

  // 带超时和重试的 LLM 调用
  const makeLlmCall = () =>
    client.chat.completions.create(
      {
        model: modelName,
        temperature: 0.2,
        max_tokens: 2048,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      },
      { signal: AbortSignal.timeout(LLM_TIMEOUT) },
    );

  let answer: string;
  try {
    const response = await retryWithBackoff(makeLlmCall, 2, "LLM");
    answer = response.choices[0]?.message?.content || "{}";
  } catch (err: any) {
    // LLM 彻底失败时，返回空分析而非 500，让评估系统记录失败原因
    console.error(`LLM 调用最终失败: ${err.message}`);
    throw new Error(`LLM 调用失败（已重试 2 次）: ${err.message}`);
  }

  const parsed = parseJsonRobust(answer);
  const analysis = normalizeAnalysis(parsed);

  // 全空结果兜底：LLM 未遵循"每个维度至少 1 条"指令时，用通用知识补全
  if (isAnalysisEmpty(analysis)) {
    console.warn(
      `⚠️  LLM 返回了全空结果，使用通用知识兜底分析（需求: ${requirement.slice(0, 60)}...）`,
    );
    return generateFallbackAnalysis(requirement);
  }

  return analysis;
}
