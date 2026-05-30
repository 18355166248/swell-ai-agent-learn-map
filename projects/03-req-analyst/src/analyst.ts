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

## 分析维度

你必须覆盖以下 6 个维度：

1. **pageChanges** — 页面改动点
   - 列出需要修改或新增的页面
   - 说明具体改动内容

2. **apiDependencies** — 接口依赖
   - 列出需求涉及的接口（从规范文档中查找）
   - 标注是新增接口(isNew:true)还是已有接口(isNew:false)

3. **trackingRequirements** — 埋点需求
   - 根据埋点规范列出需要的埋点事件
   - eventType: page_view / element_click / element_exposure / biz_event

4. **componentDependencies** — 组件依赖
   - 从组件库规范中匹配可复用的组件

5. **risks** — 风险点
   - 识别技术风险和业务风险
   - 给出缓解措施

6. **testSuggestions** — 测试点建议
   - 列出关键测试场景

## 输出格式

严格输出 JSON，不要包含 markdown 代码块标记，不要有任何额外说明文字：

{
  "pageChanges": [{ "page": "页面名", "changes": "改动内容" }],
  "apiDependencies": [{ "endpoint": "/api/xxx", "usage": "用途", "isNew": false }],
  "trackingRequirements": [{ "eventType": "page_view", "moduleId": "模块ID", "description": "说明" }],
  "componentDependencies": [{ "component": "组件名", "usage": "用途" }],
  "risks": [{ "risk": "风险描述", "level": "high/medium/low", "mitigation": "缓解措施" }],
  "testSuggestions": [{ "scenario": "测试场景", "priority": "high/medium/low" }]
}

## 重要原则

- 每个维度至少列出 1 条，如果需求确实不涉及某个维度，返回空数组 []
- 优先复用已有组件和接口，减少新增
- 风险分析要具体，不要泛泛而谈
- 测试建议要可执行，包含具体的验证点`;

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
        response_format: { type: "json_object" },
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
  return normalizeAnalysis(parsed);
}
