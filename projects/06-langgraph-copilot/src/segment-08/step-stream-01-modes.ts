/**
 * 第 8 段 · 8-A：三种最常用的 stream mode
 *
 * | Mode         | 每次 yield 什么                                       | 适用场景                   |
 * | ------------ | ----------------------------------------------------- | -------------------------- |
 * | "values"     | 完整 state 快照                                       | 调试，看每一步后的全局状态 |
 * | "updates"    | 只返回这一步改了什么                                  | 前端渲染"这一步做了什么"   |
 * | "messages"   | LLM token 级流式（需 streaming: true）                | 打字机效果                 |
 *
 * 运行：npx tsx src/segment-08/step-stream-01-modes.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 统一从仓库根 .env 读取（与生产代码一致）
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", "..", ".env"), override: true });
config({ path: resolve(__dirname, "..", "..", ".env"), override: true });
import { StateGraph, START, END, MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

// ============================================================
// 构造一个简单的图来演示 stream
// ============================================================
const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o";

function buildGraph(streaming: boolean) {
  const llm = new ChatOpenAI({ model: modelName, streaming });
  return new StateGraph(MessagesAnnotation)
    .addNode("askLLM", async (state) => {
      const response = await llm.invoke(state.messages);
      return { messages: [response] };
    })
    .addEdge(START, "askLLM")
    .addEdge("askLLM", END)
    .compile();
}

const input = {
  messages: [new HumanMessage("用一句话介绍 TypeScript")],
};

// ============================================================
// values 模式：拿完整状态
// ============================================================
console.log("=== streamMode: values ===");
const graphValues = buildGraph(false);
let chunkCount = 0;
for await (const chunk of await graphValues.stream(input, { streamMode: "values" })) {
  chunkCount++;
  console.log(`  chunk ${chunkCount}: ${chunk.messages.length} 条消息`);
}

// ============================================================
// updates 模式：只看增量
// ============================================================
console.log("\n=== streamMode: updates ===");
const graphUpdates = buildGraph(false);
chunkCount = 0;
for await (const chunk of await graphUpdates.stream(input, { streamMode: "updates" })) {
  chunkCount++;
  const keys = Object.keys(chunk);
  console.log(`  chunk ${chunkCount}: 更新的节点 = ${keys.join(", ")}`);
}

// ============================================================
// messages 模式：token 级流式（需要 streaming: true）
// ============================================================
console.log("\n=== streamMode: messages ===");
const graphMessages = buildGraph(true);
chunkCount = 0;
for await (const [msg, metadata] of await graphMessages.stream(input, { streamMode: "messages" })) {
  chunkCount++;
  if (chunkCount <= 5) {
    const preview = "content" in msg ? String((msg as any).content).slice(0, 30) : "";
    console.log(`  chunk ${chunkCount}: [${(msg as any).constructor.name}] ${preview}...`);
  }
}
console.log(`  ... 共 ${chunkCount} 个 token 级 chunk`);

// 🧪 小实验：同一查询用 3 种模式分别跑。记录每种模式每步的 chunk 数量。
