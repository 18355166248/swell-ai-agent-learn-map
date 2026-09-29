import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Client, type CallToolResult } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_PATH = resolve(PROJECT_DIR, "src/server.ts");

function printToolResult(toolName: string, result: CallToolResult): void {
  console.log(`\n== tools/call: ${toolName} ==`);

  for (const block of result.content) {
    if (block.type === "text") {
      console.log(block.text);
    } else {
      console.log(JSON.stringify(block, null, 2));
    }
  }

  if (result.isError) {
    console.log("调用结果：失败");
  }
}

export async function runClient(): Promise<void> {
  const client = new Client({
    name: "mcp-dev-tools-client",
    version: "0.1.0",
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", SERVER_PATH],
    cwd: PROJECT_DIR,
  });

  try {
    // connect() 会启动 Server 子进程，并完成 MCP 的版本协商与初始化。
    await client.connect(transport);

    const { tools } = await client.listTools();
    console.log("== tools/list ==");
    for (const tool of tools) {
      console.log(`- ${tool.name}: ${tool.description ?? "无描述"}`);
      console.log(JSON.stringify(tool.inputSchema, null, 2));
    }

    printToolResult(
      "list_files",
      await client.callTool({
        name: "list_files",
        arguments: { dir: "src", pattern: "*.ts" },
      }),
    );

    printToolResult(
      "read_file",
      await client.callTool({
        name: "read_file",
        arguments: { path: "README.md", startLine: 1, endLine: 5 },
      }),
    );

    printToolResult(
      "search_code",
      await client.callTool({
        name: "search_code",
        arguments: { query: "McpServer", dir: "src" },
      }),
    );
  } finally {
    // Client 关闭时会连同 Transport 和它启动的 Server 子进程一起回收。
    await client.close();
  }
}

function isDirectRun(): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectRun()) {
  runClient().catch((error: unknown) => {
    console.error("[mcp-dev-tools-client]", error);
    process.exitCode = 1;
  });
}
