import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { readFile } from "../../../04-dev-copilot-manual/src/agent/tools/readFile.js";
import { errorResult, textResult } from "./result.js";

export const readFileInputSchema = z
  .object({
    path: z.string().min(1).describe("相对于项目根目录的文件路径"),
    startLine: z.number().int().positive().optional().describe("起始行号，从 1 开始"),
    endLine: z.number().int().positive().optional().describe("结束行号，包含该行"),
  })
  .refine(
    ({ startLine, endLine }) =>
      startLine === undefined || endLine === undefined || endLine >= startLine,
    {
      message: "endLine 必须大于或等于 startLine",
      path: ["endLine"],
    },
  );

export type ReadFileInput = z.infer<typeof readFileInputSchema>;

export async function handleReadFile(
  args: ReadFileInput,
  projectRoot: string,
): Promise<ReturnType<typeof textResult>> {
  try {
    // 文件类型、大小和敏感路径等限制继续由项目 04 的 readFile 统一维护。
    return textResult(await readFile(args, projectRoot));
  } catch (error) {
    return errorResult(error);
  }
}

export function registerReadFileTool(server: McpServer, projectRoot: string): void {
  server.registerTool(
    "read_file",
    {
      title: "Read file",
      description: "按行读取项目内的文本文件，可指定起止行号。",
      inputSchema: readFileInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args) => handleReadFile(args, projectRoot),
  );
}
