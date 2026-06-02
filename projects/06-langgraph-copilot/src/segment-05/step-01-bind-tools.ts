/**
 * 第 5 段 · 步骤 5-1：观察 tool_calls 长什么样
 *
 * 这段只学：.bindTools() 做了什么？LLM 返回的 tool_calls 字段结构是怎样的？
 * 先观察，不执行工具。
 *
 * 运行：npx tsx src/segment-05/step-01-bind-tools.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 统一从仓库根 .env 读取（与生产代码一致）
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", "..", "..", ".env"), override: true });
config({ path: resolve(__dirname, "..", "..", ".env"), override: true });
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const addTool = new DynamicStructuredTool({
  name: "add",
  description: "计算两个数的和",
  schema: z.object({ a: z.number(), b: z.number() }),
  func: async ({ a, b }) => String(a + b),
});

const modelName = process.env.OPENAI_MODEL_NAME || "gpt-4o";
const llm = new ChatOpenAI({ model: modelName }).bindTools([addTool]);

// 问一个计算问题——LLM 应该决定调工具而不是直接回答
console.log("=== 需要工具的问题 ===");
const response = await llm.invoke([{ role: "user", content: "3 + 5 等于多少？" }]);
console.log("content:", response.content); // 通常是空字符串
console.log("tool_calls:", JSON.stringify(response.tool_calls, null, 2));
console.log("类型:", response.constructor.name); // AIMessage

// 🧪 小实验：问一个不需要工具的问题
console.log("\n=== 不需要工具的问题 ===");
const response2 = await llm.invoke([{ role: "user", content: "法国首都是什么？" }]);
console.log("content:", response2.content); // "巴黎"
console.log("tool_calls:", response2.tool_calls); // undefined 或空数组

// 这就是你手写 index.ts 第 326/343 行 if (msg.tool_calls?.length) 判断的依据
