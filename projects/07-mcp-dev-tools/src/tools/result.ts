import type { CallToolResult } from "@modelcontextprotocol/server";

export const MAX_TOOL_RESULT_CHARS = 12000;

function truncateText(text: string): string {
  if (text.length <= MAX_TOOL_RESULT_CHARS) {
    return text;
  }

  // 在协议出口统一限长，避免单个工具结果占满 Host 的模型上下文。
  const notice = `\n\n[结果已截断，原始长度 ${text.length} 字符]`;
  return `${text.slice(0, MAX_TOOL_RESULT_CHARS - notice.length)}${notice}`;
}

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text: truncateText(text) }],
  };
}

export function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [{ type: "text", text: truncateText(`工具执行错误: ${message}`) }],
    isError: true,
  };
}
