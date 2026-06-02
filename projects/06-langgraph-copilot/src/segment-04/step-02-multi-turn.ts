/**
 * 第 4 段 · 步骤 4-2：连续多轮问答
 *
 * 利用第 3 段学的 reducer + 手动把上一次的 messages 传给下一次 invoke，实现多轮对话
 *
 * 运行：npx tsx src/segment-04/step-02-multi-turn.ts
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

// 第 1 轮
let messages: any[] = [
  new SystemMessage("你是一个有帮助的助手。请用中文回答。"),
  new HumanMessage("我叫 Alice"),
];
let result = await graph.invoke({ messages });
messages = result.messages;

// 第 2 轮：依赖第 1 轮的上下文
messages.push(new HumanMessage("我刚才说我叫什么？"));
result = await graph.invoke({ messages });
const answer2 = result.messages[result.messages.length - 1];
console.log("第 2 轮回答:", answer2.content);

// 第 3 轮：继续追问
messages = result.messages;
messages.push(new HumanMessage("我们聊了几轮？"));
result = await graph.invoke({ messages });
const answer3 = result.messages[result.messages.length - 1];
console.log("第 3 轮回答:", answer3.content);

// 🧪 小实验：验证 LLM 能"记住"前面的对话——
// 这靠的是 messages 累积（reducer），不是 checkpointer（第 8 段）
