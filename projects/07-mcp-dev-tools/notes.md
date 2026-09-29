# 项目 07 学习笔记

> 按 `README.md` 的学习步骤推进。每完成一步，记录“我理解了什么、遇到了什么问题、如何验证”。

## 第 0 步：协议心智模型

### 我的理解

- Host：承载用户、模型和 MCP Client 的应用，例如 Codex、Claude Desktop 或 IDE。它决定何时让模型使用外部能力。
- Client：Host 内负责连接某一个 MCP Server 的协议客户端。它完成握手、发现能力、发起调用，并把结果交回 Host。
- Server：通过 MCP 协议暴露能力的程序。本项目的 Server 是一个由 Host 启动的本地 Node.js 子进程。
- Tool：可被模型选择并调用的动作，通常有输入参数并返回执行结果。例如 `read_file`。
- Resource：可由客户端读取的上下文数据，更接近“可寻址的资料”，例如项目说明或配置内容。
- Prompt：Server 提供的可复用提示模板，用来组织一类任务的输入，而不是替模型执行动作。

一个容易混淆但很重要的边界：MCP Server 负责声明和执行能力，不负责决定何时调用能力；做决定的仍是 Host 中的模型与 Agent 流程。

### 数据流

```text
用户
  ↓ 提出问题
Host（应用 + 模型）
  ↓ 通过内部的 MCP Client 建立连接
MCP Client
  ↓ stdin/stdout 中的 JSON-RPC 消息
MCP Server（本项目未来的 server.ts）
  ↓ 调用本地 TypeScript 函数
项目 04 的只读工具
  ↓
文件列表 / 文件内容 / 搜索结果
```

第一次连接时，可以先记住三段核心交互：

```text
1. initialize  Client 与 Server 协商协议版本和能力
2. tools/list  Client 询问 Server 提供哪些工具
3. tools/call  Client 指定工具名和参数发起调用
```

这里的 stdio 只是消息运输通道：Host 启动本地 Node.js 进程，然后向它的 stdin 写入 JSON-RPC，并从 stdout 读取 JSON-RPC。因此 Server 的普通日志必须写入 stderr；如果写入 stdout，Client 可能把日志误当成协议消息。

### Tool、Resource、Prompt 怎么区分

| 类型     | 核心问题                 | 本项目中的例子             |
| -------- | ------------------------ | -------------------------- |
| Tool     | “帮我执行一个动作”       | 搜索代码、读取文件         |
| Resource | “给我读取一份上下文”     | 暴露项目 README（进阶项）  |
| Prompt   | “给我一个完成任务的模板” | 代码审查提示模板（进阶项） |

### 本步自测

先不要看上面的内容，尝试回答：

1. 本地 MCP Server 是否必须监听 HTTP 端口？为什么？
2. `tools/list` 和 `tools/call` 分别解决什么问题？
3. 为什么服务端不能随意使用 `console.log`？
4. MCP Server 能否自己决定“现在应该调用 `read_file`”？

完成标准：能用自己的话回答以上四题，并画出 `Host → Client → Server → 真实工具` 的调用链。

### 学习确认

- 本地 stdio MCP Server 不需要监听 HTTP 端口；Client 与 Server 通过进程的标准输入和标准输出传递 JSON-RPC。
- `stdout` 是协议专用通道，普通日志混入后会导致 MCP Client 解析失败；调试日志应写入 `stderr`。
- MCP Server 负责声明和执行能力，何时调用工具仍由 Host 中的模型或 Agent 流程决定。

## 第 1 步：项目骨架与 SDK

### 本步目标

理解项目的 Node.js、TypeScript 和 MCP SDK 配置，确认开始编写 Server 之前的依赖与类型检查环境可用。

### SDK 职责

- `@modelcontextprotocol/server`：供 MCP Server 进程使用，负责声明能力、注册工具并处理客户端请求。
- `@modelcontextprotocol/client`：供 Host 内部的 Client 或我们自己编写的独立 Client 使用，负责连接 Server、发现能力并发起调用。
- `zod`：在运行时校验工具的输入参数；TypeScript 类型在编译后会被擦除，不能代替运行时校验。

Server 与 Client 是相对的协议角色，并不是“开发者使用”和“宿主使用”的固定划分。本项目第 2 步会使用 Server 包，第 5 步的 `src/client.ts` 会直接使用 Client 包。

### ESM 配置

`package.json` 中的 `"type": "module"` 告诉 Node.js 把 `.js` 文件按 ESM 解释，源码使用 `import` 和 `export`。ESM 是当前项目选择的标准模块系统，不应简单理解为“最新版一定优于 CommonJS”。

`tsconfig.json` 中与它配套的关键配置：

- `target: "ES2022"`：目标运行环境是支持现代 JavaScript 的 Node.js。
- `module: "ESNext"`：保留 ESM 模块语法。
- `moduleResolution: "bundler"`：按照现代包的导出映射解析模块。
- `strict: true`：启用严格类型检查。
- `noEmit: true`：TypeScript 只检查类型，不生成 JavaScript 文件。

### 执行命令

```bash
npm install --workspace=mcp-dev-tools
npm ls @modelcontextprotocol/server @modelcontextprotocol/client zod --workspace=mcp-dev-tools
npm run typecheck --workspace=mcp-dev-tools
```

### 验证结果

- Node.js：`20.20.0`，符合 Node.js 20+ 的要求。
- `@modelcontextprotocol/server`：`2.0.0`。
- `@modelcontextprotocol/client`：`2.0.0`。
- `zod`：`4.6.5`。
- `tsc --noEmit` 通过，没有类型错误，也没有生成 JavaScript 文件。
- `npm install` 确认依赖已是最新状态；Husky 因当前沙箱不能修改 `.git/config` 输出警告，但没有影响依赖安装，也没有产生文件变更。

### 学习确认

- Server 包由 MCP Server 使用；Client 包既可以由现成 Host 使用，也可以由自定义 Client 使用。
- `"type": "module"` 让 Node.js 使用 ESM 模块规则，源码采用 `import/export`。
- `--noEmit` 表示只进行类型检查，不输出编译后的 JavaScript。

## 第 2 步：最小 MCP Server

### 本步目标

先不接入真实文件工具，只用无参数、无副作用的 `project_info` 跑通“创建 Server、注册 Tool、连接 stdio”这条最小链路。

### 实际改动

- 新增 `src/server.ts`：提供 `createServer()` 工厂，注册 `project_info`，并在直接运行时通过 `serveStdio()` 启动服务。
- 修改 `src/index.ts`：导出 `createServer()`，供后续测试或其他模块复用。

核心结构：

```ts
export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-dev-tools",
    version: "0.1.0",
  });

  server.registerTool("project_info", config, handler);
  return server;
}

if (isDirectRun()) {
  serveStdio(() => createServer());
}
```

- `McpServer` 管理 Tools、Resources 和 Prompts 等 MCP 能力。
- `registerTool()` 同时声明工具元数据和收到 `tools/call` 后执行的处理函数。
- `serveStdio()` 把 Server 接到当前进程的 stdin/stdout，并为连接创建 Server 实例。
- `project_info` 只返回固定项目信息，不读取或修改文件，适合用来验证最小协议链路。

实际实现增加了“仅直接运行时启动”的判断。这样 `npx tsx src/server.ts` 会启动 stdio 服务，而其他模块导入 `createServer()` 时不会意外占用 stdin/stdout。

### 执行命令

```bash
npm run typecheck --workspace=mcp-dev-tools
npx prettier --check projects/07-mcp-dev-tools/src/server.ts projects/07-mcp-dev-tools/src/index.ts
cd projects/07-mcp-dev-tools
npm run server
```

### 验证结果

- TypeScript 类型检查通过。
- Prettier 格式检查通过。
- Server 启动后保持等待 Client 输入，直到使用 `Ctrl+C` 主动结束。
- 等待期间没有普通 stdout 输出，协议通道未被启动日志污染。

### 问题记录

沙箱内首次运行 `tsx` 时，其内部 IPC 管道创建被系统以 `EPERM` 拒绝。这不是 MCP Server 的实现错误；在允许创建本地 IPC 管道的环境中重跑后，Server 正常启动并等待输入。

Node.js 20 不能直接执行 `.ts` 文件。运行 `node src/server.ts` 会得到 `ERR_UNKNOWN_FILE_EXTENSION`；`"type": "module"` 只决定 JavaScript 使用 ESM 规则，不负责擦除 TypeScript 类型。项目通过 `tsx` 运行源码，因此应使用 `npm run server`（等价于 `tsx src/server.ts`）。命令末尾也不需要附加 `node_modules/` 参数。

stdio 模式下不要使用 `console.log()` 输出日志。当前 `onerror` 使用 `console.error()`，保证错误进入 stderr，不会混入 MCP 的 stdout 协议消息。

### 学习确认

- 当前 MCP Server 不监听网络端口，通信完全通过本地进程的 stdin/stdout 完成。
- `McpServer` 负责声明和执行 MCP 能力，`serveStdio` 负责在 Client 与 Server 之间传输协议消息。
- `registerTool()` 的第三个参数是工具处理函数，Client 调用 `project_info` 时由它生成结果。
- 只有直接运行 `server.ts` 时才启动 stdio；导入 `createServer()` 不会占用调用方进程的 stdin/stdout。

## 第 3 步：接入 `list_files`

### 本步目标

把项目 04 已有的 `listFiles()` 暴露成 MCP Tool，同时继续复用原实现中的路径安全边界，不在 MCP 项目中复制文件遍历代码。

### 真实调用链

```text
MCP Client
  ↓ tools/call: list_files
项目 07：src/tools/list-files.ts
  ↓ 参数校验、结果格式转换、错误包装
项目 04：listFiles()
  ↓
项目 04：safePath()
  ↓
文件系统
```

### 实际改动

- 新增 `src/tools/list-files.ts`，使用 Zod 声明 `dir` 和 `pattern` 两个可选参数。
- 在 `src/server.ts` 中调用 `registerListFilesTool()`。
- `createServer()` 接受可选的 `projectRoot`；默认使用启动进程的 `process.cwd()`。

MCP 适配器只承担三项职责：

1. 使用 Zod 把 MCP 输入转换为经过校验的 TypeScript 参数。
2. 把可信的 `projectRoot` 传给项目 04 的 `listFiles()`。
3. 把字符串结果转换为 MCP 文本 `content`；捕获异常时返回 `isError: true`。

目录穿越和敏感路径判断仍由项目 04 的 `safePath()` 负责。这样安全策略只有一份真实实现，后续修复时不会出现两个项目行为不一致。

### 验证方式

验证时使用 SDK 的 `InMemoryTransport` 临时连接 Client 与 Server。它不监听端口，也没有写入正式 Client 源码，只用于确认 MCP 注册和调用链确实可用。

验证结果：

- `tools/list` 返回 `project_info` 和 `list_files`。
- `list_files({ dir: "src", pattern: "*.ts" })` 成功返回 `index.ts`、`server.ts` 和 `tools/list-files.ts`。
- `list_files({ dir: "../04-dev-copilot-manual" })` 被拒绝，结果包含“禁止访问项目目录外的路径”，并设置 `isError: true`。
- TypeScript、Prettier 和 `git diff --check` 均通过。

### 关键边界

- `projectRoot` 决定 MCP Server 允许访问的目录范围；当前默认值是启动 Server 时的工作目录。
- Zod 负责参数形状和最小长度校验，`safePath()` 负责文件系统路径安全，两者职责不同，不能互相替代。
- 项目 04 对不存在目录返回普通文本；对目录穿越等安全违规抛出异常，因此 MCP 适配器只把后者标记为 `isError: true`。

### 学习确认

- Zod 校验 Client 参数的类型和格式；`safePath()` 阻止路径越过 `projectRoot`，并拒绝 `.env`、密钥和证书等敏感路径。
- `safePath()` 不检查目录是否存在；目录存在性由 `listFiles()` 中的文件系统检查负责。
- `projectRoot` 的首要作用是定义允许访问的目录范围，而不只是帮助定位文件。
- 工具异常转换为 `isError: true` 后，Client 能识别本次调用失败，同时 Server 可以继续处理后续请求。

## 第 4 步：补齐只读开发工具

### 本步目标

接入项目 04 的 `readFile()` 和 `searchCode()`，让 Server 具备完整的三个只读开发工具；同时统一 MCP 文本结果和错误结果，保持工具处理器可以脱离注册逻辑单独测试。

### 实际改动

- 新增 `src/tools/read-file.ts`：声明读取参数、适配 `readFile()` 并注册 `read_file`。
- 新增 `src/tools/search-code.ts`：声明搜索参数、适配 `searchCode()` 并注册 `search_code`。
- 新增 `src/tools/result.ts`：提供统一的 `textResult()` 和 `errorResult()`。
- 重构 `src/tools/list-files.ts`：改用统一结果函数，并导出独立的 `handleListFiles()`。
- 修改 `src/server.ts`：注册三个只读工具，并把 `projectRoot` 统一转换成绝对路径。

每个适配器分成三层：

```text
Zod Schema
  ↓ 声明并校验参数
handleXxx()
  ↓ 调用项目 04 的真实工具并转换结果
registerXxxTool()
  ↓ 把名称、描述、Schema 和处理器注册给 McpServer
```

三个工具都声明了只读、非破坏、幂等且不访问开放网络的 annotations。这些元数据帮助 Client 或 Host 理解工具性质，但真正的安全边界仍由代码中的 `projectRoot` 和 `safePath()` 保证。

### 参数约束

`read_file`：

- `path` 必填且不能为空。
- `startLine`、`endLine` 必须是正整数。
- 同时提供时，`endLine` 必须大于或等于 `startLine`。

`search_code`：

- `query` 必填且不能为空。
- `dir` 可选，提供时不能为空。

### 验证结果

使用 SDK 内存传输完成真实 MCP 调用：

- `tools/list` 返回 `project_info`、`list_files`、`read_file` 和 `search_code`。
- `read_file` 成功返回 `README.md` 第 1～3 行。
- `search_code` 搜索 `McpServer`，成功返回正确的 `src/...` 相对路径和行号。
- `read_file({ path: ".env" })` 被敏感路径策略拒绝，并返回 `isError: true`。
- `startLine: 5, endLine: 2` 在进入处理函数前被输入 Schema 拒绝，并返回 `isError: true`。
- TypeScript 类型检查通过。

### 问题记录

第一次验证时传入了相对形式的 `projectRoot`。安全工具内部会使用绝对路径，而 `searchCode()` 使用传入的根路径长度截取相对文件名，导致结果出现错误前缀。修复方式是在 Server 入口通过 `resolve()` 把根目录统一转换成绝对路径，再把同一个值传给所有真实工具。

验证期间发现 `server.ts` 中存在一条 `console.log()` 调试输出。stdio 的 stdout 是协议通道，因此保留调试信息但改用 `console.error()` 输出到 stderr。

这说明类型检查只能证明类型关系成立，不能证明文件路径和协议通道等运行时语义正确，仍需执行真实调用验证。

### 学习确认

- `textResult()` 和 `errorResult()` 统一三个工具的 MCP 返回格式，后续修改成功或错误格式时只需维护一处。
- `registerXxxTool()` 负责协议层的名称、描述、Schema 和注册；`handleXxx()` 接收已校验参数、调用真实工具并生成结果，可以脱离 `McpServer` 单独测试。
- `readOnlyHint` 等 annotations 只向 Client、Host 或模型描述工具性质，不会自动阻止代码写文件，不能代替 `safePath()` 等真实安全检查。
- `projectRoot` 在入口统一转换成绝对路径，让路径越界判断和相对文件名计算使用同一个稳定基准。

## 第 5～6 步：Client、Inspector 与真实 Host

待补充。

## 第 7 步：测试与安全边界

待补充。

## 第 8 步：MCP 与 Function Calling 对比

待补充。

## 最终总结

- MCP 最适合解决的问题：
- 不适合使用 MCP 的场景：
- 与项目 04 相比最大的认知变化：
- 下一步计划：
