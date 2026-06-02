/**
 * 第 6 段 · 步骤 6-1：单独测试工具（不经过图）
 *
 * DynamicStructuredTool 可在图外直接调用（tool.invoke({...})），方便单独测试
 *
 * 运行：npx tsx src/segment-06/step-01-test-tool-alone.ts
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const addTool = new DynamicStructuredTool({
  name: "add",
  description: "计算两个数的和",
  schema: z.object({ a: z.number(), b: z.number() }),
  func: async ({ a, b }) => String(a + b),
});

// 直接调用工具——不需要图、不需要 LLM、不需要 ToolNode
const result = await addTool.invoke({ a: 3, b: 5 });
console.log("add(3, 5) =", result); // "8"

// 🧪 Zod 自动校验：传入错误类型会直接报错
try {
  await addTool.invoke({ a: "hello", b: 5 } as any);
} catch (e: any) {
  console.log("Zod 校验报错:", e.message);
}

// 🧪 缺参数
try {
  await addTool.invoke({ a: 3 } as any);
} catch (e: any) {
  console.log("缺参数报错:", e.message);
}

// 🧪 多传参数（Zod 默认忽略多余字段，不会报错）
const resultExtra = await addTool.invoke({ a: 3, b: 5, c: 999 } as any);
console.log("多传参数:", resultExtra); // "8"——多余字段被忽略
