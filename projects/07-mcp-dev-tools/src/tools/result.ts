import type { CallToolResult } from "@modelcontextprotocol/server";

export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

export function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [{ type: "text", text: `工具执行错误: ${message}` }],
    isError: true,
  };
}
