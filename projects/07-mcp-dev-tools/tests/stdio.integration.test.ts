import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_PATH = resolve(PROJECT_DIR, "src/server.ts");

describe("stdio Client/Server", () => {
  it("完成 tools/list 和一次 tools/call", async () => {
    const client = new Client({ name: "stdio-integration-test", version: "0.1.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", SERVER_PATH],
      cwd: PROJECT_DIR,
      stderr: "ignore",
    });

    try {
      // 这里连接真实子进程，覆盖内存传输无法证明的 stdin/stdout 协议链路。
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual([
        "project_info",
        "list_files",
        "read_file",
        "search_code",
      ]);

      const result = await client.callTool({
        name: "list_files",
        arguments: { dir: "src", pattern: "*.ts" },
      });
      expect(result.isError).not.toBe(true);
      expect(result.content[0]).toMatchObject({ type: "text" });
    } finally {
      // 即使断言失败也要回收 Server 子进程，避免测试进程残留。
      await client.close();
    }
  }, 15000);
});
