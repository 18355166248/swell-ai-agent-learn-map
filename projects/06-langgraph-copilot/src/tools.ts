/**
 * LangGraph 版工具集 —— 从手写 registry.ts 迁移到 DynamicStructuredTool
 *
 * 对比手写版（projects/04-dev-copilot/src/agent/tools/registry.ts）：
 *   - JSON Schema → Zod schema（类型安全 + 自动校验）
 *   - 裸函数 → DynamicStructuredTool（可独立测试，也可用于 ToolNode）
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================================
// 工具执行逻辑 —— 复用已有的实现
// ============================================================
import { readFile as readFileImpl } from "../../04-dev-copilot/src/agent/tools/readFile.js";
import { listFiles as listFilesImpl } from "../../04-dev-copilot/src/agent/tools/listFiles.js";
import { searchCode as searchCodeImpl } from "../../04-dev-copilot/src/agent/tools/searchCode.js";
import { searchDocs as searchDocsImpl } from "../../04-dev-copilot/src/agent/tools/searchDocs.js";
import { grep as grepImpl } from "../../04-dev-copilot/src/agent/tools/grep.js";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function detectProjectRoot(): string {
  let dir = resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    const pkgPath = resolve(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "swell-ai-agent-learn-map") return dir;
      } catch {
        /* not valid JSON */
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, "..", "..", "..", "..");
}

const DEFAULT_PROJECT_ROOT = detectProjectRoot();

// ============================================================
// 工具定义
// ============================================================

export const readFileTool = new DynamicStructuredTool({
  name: "read_file",
  description:
    "读取指定文件的内容。可以指定起始行和结束行来读取文件的一部分。路径相对于项目根目录。",
  schema: z.object({
    path: z.string().describe("文件路径，相对于项目根目录"),
    startLine: z.number().optional().describe("起始行号（可选，1-based）"),
    endLine: z.number().optional().describe("结束行号（可选，1-based，包含）"),
  }),
  func: async (args) => readFileImpl(args, DEFAULT_PROJECT_ROOT),
});

export const listFilesTool = new DynamicStructuredTool({
  name: "list_files",
  description:
    "列出指定目录下的文件和子目录。可以按文件模式过滤（如 *.ts, *.json）。路径相对于项目根目录。",
  schema: z.object({
    dir: z.string().optional().describe("目录路径，相对于项目根目录（默认为项目根目录）"),
    pattern: z.string().optional().describe("文件模式过滤，如 *.ts, *.json"),
  }),
  func: async (args) => listFilesImpl(args, DEFAULT_PROJECT_ROOT),
});

export const searchCodeTool = new DynamicStructuredTool({
  name: "search_code",
  description:
    "在代码文件中按关键词搜索。在 .ts/.tsx/.js/.jsx/.json 等文件中查找包含指定关键词的内容。返回文件名、行号和匹配行内容。注意：这是关键词匹配，不是语义搜索。",
  schema: z.object({
    query: z.string().describe("搜索关键词"),
    dir: z.string().optional().describe("搜索目录，相对于项目根目录（默认为整个项目）"),
  }),
  func: async (args) => searchCodeImpl(args, DEFAULT_PROJECT_ROOT),
});

export const searchDocsTool = new DynamicStructuredTool({
  name: "search_docs",
  description:
    "在内部文档知识库中进行语义搜索。适用于查找技术规范、API 文档、开发指南等文档内容。支持中文查询。返回相关文档片段及其来源和相似度分数。",
  schema: z.object({
    query: z.string().describe("搜索查询，可以是自然语言问题"),
  }),
  func: async (args) => searchDocsImpl(args, DEFAULT_PROJECT_ROOT),
});

export const grepTool = new DynamicStructuredTool({
  name: "grep",
  description:
    "使用正则表达式在代码文件中搜索。比 search_code 更灵活，支持模式匹配。返回匹配的文件名、行号和上下文。",
  schema: z.object({
    pattern: z.string().describe("正则表达式模式"),
    dir: z.string().optional().describe("搜索目录，相对于项目根目录（默认为整个项目）"),
  }),
  func: async (args) => grepImpl(args, DEFAULT_PROJECT_ROOT),
});

/** 全部工具列表 */
export const allTools = [readFileTool, listFilesTool, searchCodeTool, searchDocsTool, grepTool];
