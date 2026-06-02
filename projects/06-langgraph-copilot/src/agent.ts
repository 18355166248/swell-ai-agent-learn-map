/**
 * LangGraph 版 Agent —— 生产级 ReAct 图
 *
 * 这是手写版 index.ts（483 行）的 LangGraph 等价实现。
 *
 * 核心对比：
 *   手写 60 行循环逻辑（for + if/else + messages.push + break/continue）
 *   → LangGraph 4 条边（addEdge + addConditionalEdges）
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: true });
config({ path: resolve(__dirname, "..", ".env"), override: true });

import { StateGraph, START, END, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { allTools } from "./tools.js";
import { SYSTEM_PROMPT } from "../../04-dev-copilot/src/agent/prompts.js";

// ============================================================
// 配置
// ============================================================
const ANTHROPIC_MODEL_NAME = process.env.ANTHROPIC_MODEL_NAME || "claude-sonnet-4-6";
export const DEFAULT_RECURSION_LIMIT = 13;

// ============================================================
// LLM + 工具绑定
// ============================================================
// Anthropic SDK 自动追加 /v1/messages，baseURL 不能以 /v1 结尾
const baseURL = (process.env.ANTHROPIC_BASE_URL || "").replace(/\/v1\/?$/, "");

const llm = new ChatAnthropic({
  model: ANTHROPIC_MODEL_NAME,
  temperature: 0.3,
  clientOptions: { baseURL },
}).bindTools(allTools);

const toolNode = new ToolNode(allTools);

// ============================================================
// 路由函数（替代手写 for 循环中的 if/else 判断）
// ============================================================
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && "tool_calls" in lastMsg && (lastMsg as any).tool_calls?.length) {
    return "tools";
  }
  return "__end__";
}

// ============================================================
// ReAct 图定义（不 compile，由调用方按需 compile）
// ============================================================
function buildReactGraph() {
  return new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const response = await llm.invoke(state.messages);
      return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, { tools: "tools", __end__: END })
    .addEdge("tools", "agent");
}

// ============================================================
// 公开 API
// ============================================================

export function makeThreadId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

export interface AgentConfig {
  threadId?: string;
  recursionLimit?: number;
  checkpointer?: MemorySaver;
}

/**
 * 构建初始消息。如果 thread 已有 checkpoint 则只追加用户消息，
 * 避免重复注入 SystemMessage 导致消息堆积。
 */
export async function buildMessages(
  task: string,
  graph: ReturnType<typeof getGraph>,
  threadId: string,
): Promise<(SystemMessage | HumanMessage)[]> {
  try {
    const state = await graph.getState({ configurable: { thread_id: threadId } });
    const hasHistory = state && state.values && (state.values as any).messages?.length > 0;
    if (hasHistory) {
      return [new HumanMessage(task)];
    }
  } catch {
    // getState 失败（无 checkpoint），按新会话处理
  }
  return [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(task)];
}

/**
 * 运行 Agent（非流式）
 */
export async function runAgent(task: string, opts: AgentConfig = {}) {
  const { threadId, recursionLimit = DEFAULT_RECURSION_LIMIT, checkpointer } = opts;

  const hasCheckpointer = !!checkpointer;
  const effectiveThreadId = threadId || (hasCheckpointer ? makeThreadId() : undefined);

  const graph = hasCheckpointer
    ? buildReactGraph().compile({ checkpointer })
    : buildReactGraph().compile();

  const invokeConfig: any = { recursionLimit };
  if (effectiveThreadId) {
    invokeConfig.configurable = { thread_id: effectiveThreadId };
  }

  const messages =
    effectiveThreadId && hasCheckpointer
      ? await buildMessages(task, graph, effectiveThreadId)
      : [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(task)];

  const result = await graph.invoke({ messages }, invokeConfig);

  const lastMsg = result.messages[result.messages.length - 1];
  return {
    answer: (lastMsg as any).content || "",
    messageCount: result.messages.length,
    messages: result.messages,
    threadId: effectiveThreadId,
  };
}

/**
 * 获取编译后的图实例（用于 stream / getState 等高级操作）
 */
export function getGraph(checkpointer?: MemorySaver) {
  const graph = buildReactGraph();
  return checkpointer ? graph.compile({ checkpointer }) : graph.compile();
}

/**
 * 创建 MemorySaver 实例（如需跨 invocation 持久化）
 */
export function createCheckpointer() {
  return new MemorySaver();
}
