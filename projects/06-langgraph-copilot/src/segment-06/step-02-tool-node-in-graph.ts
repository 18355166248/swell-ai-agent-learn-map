/**
 * 第 6 段 · 步骤 6-2：ToolNode 在图中执行工具
 *
 * 这段只学：ToolNode 自动做了什么？和 DynamicStructuredTool 的关系？
 *
 * ToolNode 做了什么（阅读即可）：
 *   1. 取 state.messages 最后一条 AIMessage
 *   2. 检查 AIMessage.tool_calls
 *   3. 对每个 tool_call：匹配工具 → 执行 func → 构造 ToolMessage
 *   4. 返回 { messages: [ToolMessage, ...] }
 *
 * 手写对应关系：
 *   ToolNode 替代了 index.ts 中工具调用主循环的部分：
 *     - 遍历 msg.tool_calls
 *     - 解析 JSON
 *     - 调用 executeTool
 *     - 构造 tool 消息
 *
 * 运行：npx tsx src/segment-06/step-02-tool-node-in-graph.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 统一从仓库根 .env 读取（与生产代码一致）
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", "..", ".env"), override: true });
config({ path: resolve(__dirname, "..", "..", ".env"), override: true });
import { StateGraph, START, END, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

const addTool = new DynamicStructuredTool({
  name: "add",
  description: "计算两个数的和",
  schema: z.object({ a: z.number(), b: z.number() }),
  func: async ({ a, b }) => String(a + b),
});

const multiplyTool = new DynamicStructuredTool({
  name: "multiply",
  description: "计算两个数的乘积",
  schema: z.object({ a: z.number(), b: z.number() }),
  func: async ({ a, b }) => String(a * b),
});

const tools = [addTool, multiplyTool];
const toolNode = new ToolNode(tools);

const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o";
const llm = new ChatOpenAI({ model: modelName }).bindTools(tools);

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", async (state) => {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges(
    "agent",
    (state) => {
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg && "tool_calls" in lastMsg && (lastMsg as any).tool_calls?.length) {
        return "tools";
      }
      return "__end__";
    },
    { tools: "tools", __end__: END },
  )
  .addEdge("tools", "agent")
  .compile();

const result = await graph.invoke({
  messages: [new HumanMessage("先算 3+5，再把结果乘以 2，最终结果是多少？")],
});

const lastMsg = result.messages[result.messages.length - 1];
console.log("最终回答:", lastMsg.content);

// 🧪 小实验：观察中间消息。result.messages 包含了完整的对话链：
// HumanMessage → AIMessage(tool_calls) → ToolMessage → AIMessage(tool_calls) → ToolMessage → AIMessage(最终答案)
console.log("\n消息链:");
for (const msg of result.messages) {
  const type = msg.constructor.name;
  const preview = "content" in msg ? String((msg as any).content).slice(0, 60) : "";
  const hasToolCalls = "tool_calls" in msg && (msg as any).tool_calls?.length;
  console.log(
    `  [${type}]${hasToolCalls ? ` tool_calls: ${(msg as any).tool_calls.length}` : ""} ${preview}`,
  );
}
