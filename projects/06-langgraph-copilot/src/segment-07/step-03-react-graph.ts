/**
 * 第 7 段 · 步骤 7-3：完整的 ReAct 图（Agent → 路由 → Tools → 循环）
 *
 * 这就是你手写 runAgent() 函数（index.ts 第 219-483 行）的 LangGraph 版本。
 *
 * 对照：
 *   messages 数组              → MessagesAnnotation 的 reducer
 *   client.chat.completions    → llm.invoke()
 *   msg.tool_calls 判断         → shouldContinue router
 *   executeTool()              → ToolNode
 *   for 循环上限               → recursionLimit
 *   break                      → "__end__"
 *   continue                   → addEdge("tools", "agent")
 *
 * 你手写的 ~60 行核心循环逻辑收缩成了 4 条边。
 *
 * 运行：npx tsx src/segment-07/step-03-react-graph.ts
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
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

// ============================================================
// 工具定义
// ============================================================
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

// ============================================================
// 模型 + 工具绑定
// ============================================================
const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o";
const llm = new ChatOpenAI({
  model: modelName,
  temperature: 0.3,
}).bindTools(tools);

const toolNode = new ToolNode(tools);

// ============================================================
// 路由函数
// ============================================================
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMsg = state.messages[state.messages.length - 1];
  if (lastMsg && "tool_calls" in lastMsg && (lastMsg as any).tool_calls?.length) {
    return "tools";
  }
  return "__end__";
}

// ============================================================
// ReAct 图：4 条边替代 60 行循环
// ============================================================
const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", async (state) => {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, { tools: "tools", __end__: END })
  .addEdge("tools", "agent") // ← 循环回 agent：工具结果返回给 LLM 继续思考
  .compile();

// ============================================================
// 运行
// ============================================================
const result = await graph.invoke(
  {
    messages: [
      new SystemMessage("你是一个数学助手。请使用工具计算，用中文回答。"),
      new HumanMessage("计算 (3 + 5) * 2 的结果"),
    ],
  },
  { recursionLimit: 13 },
);

const lastMsg = result.messages[result.messages.length - 1];
console.log("最终回答:", lastMsg.content);

// 打印完整的消息流转
console.log("\n=== 消息流转 ===");
for (const msg of result.messages) {
  const type = msg.constructor.name;
  const hasToolCalls = "tool_calls" in msg && (msg as any).tool_calls?.length;
  if (hasToolCalls) {
    console.log(
      `[${type}] tool_calls:`,
      (msg as any).tool_calls.map((tc: any) => tc.name),
    );
  } else if ("content" in msg) {
    const preview = String((msg as any).content).slice(0, 80);
    console.log(`[${type}] ${preview}`);
  }
}
