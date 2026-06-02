/**
 * 第 8 段 · 8-B：Thread 管理
 *
 * - graph.getState(config) — 查看某 thread 的当前 state
 * - 多个 thread_id 并发对话，验证隔离性
 *
 * 运行：npx tsx src/segment-08/step-memory-02-threads.ts
 */

import "dotenv/config";
import { StateGraph, START, END, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const modelName = process.env.MODEL_NAME || "gpt-4o";
const llm = new ChatOpenAI({ model: modelName });

function buildGraph() {
  return new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const response = await llm.invoke(state.messages);
      return { messages: [response] };
    })
    .addEdge(START, "agent")
    .addEdge("agent", END);
}

const checkpointer = new MemorySaver();
const graph = buildGraph().compile({ checkpointer });

const systemMsg = new SystemMessage("你是一个有帮助的助手。请用中文回答。");

// 创建 3 个 thread，各自独立对话
const threads = [
  { id: "thread-a", name: "Alice" },
  { id: "thread-b", name: "Bob" },
  { id: "thread-c", name: "Charlie" },
];

// 每个 thread 自我介绍
for (const t of threads) {
  await graph.invoke(
    {
      messages: [systemMsg, new HumanMessage(`我叫 ${t.name}`)],
    },
    { configurable: { thread_id: t.id } },
  );
}

// 每个 thread 问"我叫什么？"——各自只能记住自己的名字
for (const t of threads) {
  const result = await graph.invoke(
    {
      messages: [new HumanMessage("我刚才说我叫什么？")],
    },
    { configurable: { thread_id: t.id } },
  );
  const answer = (result.messages[result.messages.length - 1] as any).content.slice(0, 80);
  console.log(`${t.id} (${t.name}): ${answer}`);
}

// 用 getState 验证隔离性
console.log("\n=== 各 thread 的消息数 ===");
for (const t of threads) {
  const state = await graph.getState({ configurable: { thread_id: t.id } });
  console.log(`${t.id}: ${(state.values as any).messages.length} 条消息`);
}

// 🧪 小实验：创建 3 个 thread 并发对话，各自独立发展。
// 用 getState 验证互不干扰。
