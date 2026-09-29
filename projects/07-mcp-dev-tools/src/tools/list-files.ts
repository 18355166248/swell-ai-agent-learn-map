import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { listFiles } from "../../../04-dev-copilot-manual/src/agent/tools/listFiles.js";

const listFilesInputSchema = z.object({
  dir: z.string().min(1).optional().describe("相对于项目根目录的目录，默认使用项目根目录"),
  pattern: z.string().min(1).optional().describe("文件过滤模式，例如 *.ts 或 src/**/*.ts"),
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function registerListFilesTool(server: McpServer, projectRoot: string): void {
  server.registerTool(
    "list_files",
    {
      title: "List files",
      description: "列出项目目录中的文件和子目录，可使用文件模式过滤。",
      inputSchema: listFilesInputSchema,
    },
    async (args) => {
      try {
        // projectRoot 是 MCP 层与真实文件工具之间的安全边界，路径校验继续复用项目 04。
        const result = await listFiles(args, projectRoot);
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `工具执行错误: ${getErrorMessage(error)}` }],
          isError: true,
        };
      }
    },
  );
}
