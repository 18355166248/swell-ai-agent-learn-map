/**
 * 第 4 段 · 步骤 4-1：第一个 LLM 节点
 *
 * 这段只学：在图节点里调 LLM —— ChatOpenAI + llm.invoke()
 *
 * 运行：npx tsx src/segment-04/step-01-first-llm-node.ts
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
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o";
const llm = new ChatOpenAI({ model: modelName });

const graph = new StateGraph(MessagesAnnotation)
  .addNode("askLLM", async (state) => {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  })
  .addEdge(START, "askLLM")
  .addEdge("askLLM", END)
  .compile();

const result = await graph.invoke({
  messages: [
    new SystemMessage("你是一个有帮助的助手。请用中文回答。"),
    new HumanMessage("TypeScript 的 satisfies 关键字做什么？"),
  ],
});

const answer = result.messages[result.messages.length - 1];
console.log(answer.content);

// 🧪 小实验：对照手写版 index.ts 第 288-303 行。
// llm.invoke(state.messages) 替代了 client.chat.completions.create({ model, messages, tools })
