import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { searchCode } from "../../../04-dev-copilot-manual/src/agent/tools/searchCode.js";
import { errorResult, textResult } from "./result.js";

export const searchCodeInputSchema = z.object({
  query: z.string().min(1).describe("需要搜索的代码关键词"),
  dir: z.string().min(1).optional().describe("相对于项目根目录的搜索目录"),
});

export type SearchCodeInput = z.infer<typeof searchCodeInputSchema>;

export async function handleSearchCode(
  args: SearchCodeInput,
  projectRoot: string,
): Promise<ReturnType<typeof textResult>> {
  try {
    // 搜索范围必须和文件读取共用同一个 projectRoot，避免不同工具出现安全边界漂移。
    return textResult(await searchCode(args, projectRoot));
  } catch (error) {
    return errorResult(error);
  }
}

export function registerSearchCodeTool(server: McpServer, projectRoot: string): void {
  server.registerTool(
    "search_code",
    {
      title: "Search code",
      description: "在项目代码和文档文件中按关键词搜索，返回文件、行号和匹配内容。",
      inputSchema: searchCodeInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args) => handleSearchCode(args, projectRoot),
  );
}
