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

  // Query 改写 + 向量检索
  const expanded = await rewriteQuery(requirement, model);
  const searchQuery = `${requirement} | ${expanded}`;
  const queryEmb = await getEmbedding(searchQuery);

  // 混合检索（向量 + BM25）
  const vecResults = retrieve(queryEmb, vectors, 6);
  const bm25 = new BM25Search(vectors);
  const kwResults = bm25.search(searchQuery, 6);
  const results = hybridRetrieve(vecResults, kwResults, 5);

  const chunks = results.map((r) => r.entry.chunk);
  const userPrompt = buildUserPrompt(requirement, chunks);

  const client = getClient();
  const modelName = model || DEFAULT_MODEL;

  const response = await client.chat.completions.create({
    model: modelName,
    temperature: 0.2,
    max_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const answer = response.choices[0]?.message?.content || "{}";

  // 解析 JSON，处理可能的 markdown 包裹
  const jsonStr = answer
    .replace(/^```json?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonStr);

    // 确保所有字段存在
    return {
      pageChanges: parsed.pageChanges || [],
      apiDependencies: parsed.apiDependencies || [],
      trackingRequirements: parsed.trackingRequirements || [],
      componentDependencies: parsed.componentDependencies || [],
      risks: parsed.risks || [],
      testSuggestions: parsed.testSuggestions || [],
    };
  } catch {
    console.error("JSON 解析失败:", jsonStr.slice(0, 300));
    return {
      pageChanges: [],
      apiDependencies: [],
      trackingRequirements: [],
      componentDependencies: [],
      risks: [],
      testSuggestions: [],
    };
  }
}
