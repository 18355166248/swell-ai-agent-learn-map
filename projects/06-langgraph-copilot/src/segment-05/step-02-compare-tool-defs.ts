/**
 * 第 5 段 · 步骤 5-2：对照手写版的工具定义
 *
 * 展示手写版和 LangChain 版对同一个工具（read_file）的定义差异
 *
 * 运行：npx tsx src/segment-05/step-02-compare-tool-defs.ts
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================================
// 手写版（registry.ts）—— 裸 JSON Schema
// ============================================================
const handWritten = {
  type: "function" as const,
  function: {
    name: "read_file",
    description: "读取指定文件的内容...",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const },
        startLine: { type: "number" as const },
        endLine: { type: "number" as const },
      },
      required: ["path"],
    },
  },
};

// ============================================================
// LangChain 版 —— Zod schema（类型安全 + 自动校验）
// ============================================================
const langChainTool = new DynamicStructuredTool({
  name: "read_file",
  description: "读取指定文件的内容。可以指定起始行和结束行。",
  schema: z.object({
    path: z.string().describe("文件路径，相对于项目根目录"),
    startLine: z.number().optional().describe("起始行号（1-based）"),
    endLine: z.number().optional().describe("结束行号（1-based）"),
  }),
  func: async ({ path, startLine, endLine }) => {
    return `[模拟] 读取 ${path}${startLine ? ` 从第 ${startLine} 行` : ""}${endLine ? ` 到第 ${endLine} 行` : ""}`;
  },
});

console.log("=== 手写版（JSON Schema）===");
console.log(JSON.stringify(handWritten, null, 2));

console.log("\n=== LangChain 版（Zod schema）===");
console.log("name:", langChainTool.name);
console.log("description:", langChainTool.description);
console.log("schema:", langChainTool.schema.description);

// 🧪 Zod 自动校验：传入错误类型
try {
  await langChainTool.invoke({ path: 123 } as any); // 类型错误
} catch (e: any) {
  console.log("\nZod 校验报错:", e.message);
}

// 🧪 正常调用
const result = await langChainTool.invoke({ path: "src/index.ts", startLine: 1, endLine: 50 });
console.log("正常调用结果:", result);

// 对比结论：
// Zod schema 比 JSON Schema 多了：
// 1. 类型推断（TypeScript 直接推导参数类型）
// 2. describe() 同时充当注释和 LLM 提示
// 3. 参数校验在运行时自动执行（JSON Schema 需要额外校验层）
