import type OpenAI from "openai";
import { readFile } from "./readFile.js";
import { listFiles } from "./listFiles.js";
import { searchCode } from "./searchCode.js";
import { searchDocs } from "./searchDocs.js";
import { grep } from "./grep.js";

type ToolExecutor = (args: Record<string, any>) => Promise<string>;

type AgentTool = OpenAI.Chat.Completions.ChatCompletionTool;

const toolFactories: Record<string, (root: string) => ToolExecutor> = {
  read_file: (root) => (args) => readFile(args as any, root),
  list_files: (root) => (args) => listFiles(args as any, root),
  search_code: (root) => (args) => searchCode(args as any, root),
  search_docs: (root) => (args) => searchDocs(args as any, root),
  grep: (root) => (args) => grep(args as any, root),
};

const toolDefinitions: AgentTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "读取指定文件的内容。可以指定起始行和结束行来读取文件的一部分。路径相对于项目根目录。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径，相对于项目根目录" },
          startLine: { type: "number", description: "起始行号（可选，1-based）" },
          endLine: { type: "number", description: "结束行号（可选，1-based，包含）" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "列出指定目录下的文件和子目录。可以按文件模式过滤（如 *.ts, *.json）。路径相对于项目根目录。",
      parameters: {
        type: "object",
        properties: {
          dir: { type: "string", description: "目录路径，相对于项目根目录（默认为项目根目录）" },
          pattern: { type: "string", description: "文件模式过滤，如 *.ts, *.json" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_code",
      description:
        "在代码文件中按关键词搜索。在 .ts/.tsx/.js/.jsx/.json 等文件中查找包含指定关键词的内容。返回文件名、行号和匹配行内容。注意：这是关键词匹配，不是语义搜索。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
          dir: { type: "string", description: "搜索目录，相对于项目根目录（默认为整个项目）" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_docs",
      description:
        "在内部文档知识库中进行语义搜索。适用于查找技术规范、API 文档、开发指南等文档内容。支持中文查询。返回相关文档片段及其来源和相似度分数。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索查询，可以是自然语言问题" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "grep",
      description:
        "使用正则表达式在代码文件中搜索。比 search_code 更灵活，支持模式匹配。返回匹配的文件名、行号和上下文。",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "正则表达式模式" },
          dir: { type: "string", description: "搜索目录，相对于项目根目录（默认为整个项目）" },
        },
        required: ["pattern"],
      },
    },
  },
];

export function getToolExecutor(name: string, projectRoot: string): ToolExecutor {
  const factory = toolFactories[name];
  if (!factory) throw new Error(`未知工具: ${name}`);
  return factory(projectRoot);
}

export function getToolDefinitions(): AgentTool[] {
  return toolDefinitions;
}

export async function executeTool(
  name: string,
  args: Record<string, any>,
  projectRoot: string,
): Promise<string> {
  try {
    const executor = getToolExecutor(name, projectRoot);
    return await executor(args);
  } catch (err: any) {
    return `工具执行错误: ${err.message}`;
  }
}
