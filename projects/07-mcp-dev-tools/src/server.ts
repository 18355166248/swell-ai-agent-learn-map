import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { registerListFilesTool } from "./tools/list-files.js";
import { registerReadFileTool } from "./tools/read-file.js";
import { registerSearchCodeTool } from "./tools/search-code.js";

const PROJECT_INFO = {
  name: "mcp-dev-tools",
  version: "0.1.0",
  description: "通过 MCP 暴露只读开发工具的学习项目",
  transport: "stdio",
} as const;

interface CreateServerOptions {
  projectRoot?: string;
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  // 旧工具会基于根目录计算相对路径，入口统一绝对化可避免相对路径导致展示和安全判断漂移。
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const server = new McpServer({
    name: PROJECT_INFO.name,
    version: PROJECT_INFO.version,
  });

  server.registerTool(
    "project_info",
    {
      title: "Project information",
      description: "返回当前 MCP 学习项目的基本信息，不读取或修改任何文件。",
    },
    () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(PROJECT_INFO, null, 2),
        },
      ],
    }),
  );

  console.error("[mcp-dev-tools] projectRoot:", projectRoot);
  registerListFilesTool(server, projectRoot);
  registerReadFileTool(server, projectRoot);
  registerSearchCodeTool(server, projectRoot);

  return server;
}

function isDirectRun(): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && import.meta.url === pathToFileURL(entryPath).href;
}

if (isDirectRun()) {
  // stdio 的 stdout 是 MCP 协议专用通道，启动信息和异常只能写入 stderr。
  serveStdio(() => createServer(), {
    onerror: (error) => console.error("[mcp-dev-tools]", error),
  });
}
