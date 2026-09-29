# 项目 07：MCP Dev Tools

> 当前状态：准备阶段完成，等待按步骤实现
> 学习目标：使用官方 TypeScript SDK，把项目 04 的只读开发工具暴露为 MCP Server，并通过 MCP Client、Inspector 和真实 Host 验证调用

## 这是什么

这是一个从零学习 Model Context Protocol（MCP）的实践项目。

项目不会重新发明文件工具，而是复用 `projects/04-dev-copilot-manual` 已实现的路径安全和只读工具，把学习重点放在：

- MCP Server 如何声明和暴露能力
- MCP Client 如何发现并调用工具
- MCP 的 Tool 与模型 Function Calling 是什么关系
- stdio 传输如何工作，为什么 stdout 不能混入普通日志
- 如何验证一个 MCP Server 能被 Inspector 和真实 Host 使用

## 最小项目目标

完成下面这条最小闭环：

```text
MCP Client / Inspector / Host
        ↓ initialize + tools/list + tools/call
本地 stdio MCP Server
        ↓ 参数校验与工具适配
项目 04 的只读工具
        ↓
项目文件和代码搜索结果
```

第一版只实现三个工具：

| MCP Tool      | 复用实现                                           | 作用               |
| ------------- | -------------------------------------------------- | ------------------ |
| `list_files`  | `04-dev-copilot-manual/src/agent/tools/listFiles`  | 浏览目录结构       |
| `read_file`   | `04-dev-copilot-manual/src/agent/tools/readFile`   | 按行读取安全文件   |
| `search_code` | `04-dev-copilot-manual/src/agent/tools/searchCode` | 在代码中搜索关键词 |

明确不在第一版实现：写文件、执行 Shell、远程部署、OAuth、多租户、复杂 Resources/Prompts。

## 技术选择

- Node.js 20+
- TypeScript + ESM
- MCP TypeScript SDK v2
- Zod v4
- 本地传输：stdio
- 测试：Vitest

新项目使用拆分后的 v2 包：Server 使用 `@modelcontextprotocol/server`，Client 使用 `@modelcontextprotocol/client`。本地集成优先使用 stdio；需要部署为共享远程服务时，再学习 Streamable HTTP。

## 学习步骤（按顺序）

每一步完成后，都在 `notes.md` 记录以下内容，确保学习过程可以复习和复现：

1. 本步目标与核心概念
2. 实际新增或修改的文件
3. 执行过的命令及其作用
4. 验证结果与完成标准
5. 容易混淆的边界或遇到的问题

### 第 0 步：建立协议心智模型

- [x] 区分 Host、Client、Server 三个角色
- [x] 理解 MCP 的 Tools、Resources、Prompts 三类能力
- [x] 理解 `initialize -> tools/list -> tools/call` 的基本交互
- [x] 理解 MCP 负责“能力发现和调用协议”，模型仍负责“何时选择工具”
- [x] 理解 stdio 只是传输方式，协议消息本质上是 JSON-RPC

学习产出：能画出 Host、MCP Client、MCP Server、真实工具之间的数据流。

### 第 1 步：认识项目骨架与 SDK

- [x] 阅读 `package.json` 和 `tsconfig.json`
- [x] 查看官方 Server 与 Client 包的职责差异
- [x] 运行 `npm install`
- [x] 运行 `npm run typecheck`

学习产出：知道为什么 Server 和 Client 使用两个独立 SDK 包，以及为什么项目必须使用 ESM。

### 第 2 步：写第一个最小 MCP Server

- [ ] 创建 `src/server.ts`
- [ ] 使用 `McpServer` 创建 Server
- [ ] 注册一个无副作用的 `project_info` 工具
- [ ] 使用 `serveStdio(() => createServer())` 启动 stdio 服务
- [ ] 所有调试日志使用 `console.error`，不向 stdout 写普通日志

验收：Server 能启动并等待 Client 连接；stdout 中没有非协议内容。

### 第 3 步：接入第一个真实工具

- [ ] 创建 `src/tools/list-files.ts`
- [ ] 使用 Zod 定义 `list_files` 的输入 Schema
- [ ] 调用项目 04 已有的 `listFiles` 实现
- [ ] 把字符串结果转换成 MCP `content` 文本块
- [ ] 捕获异常并返回 `isError: true`，不要让整个 Server 崩溃

验收：可以列出仓库内指定目录，但无法绕过项目 04 的路径安全边界。

### 第 4 步：补齐只读开发工具

- [ ] 接入 `read_file`
- [ ] 接入 `search_code`
- [ ] 为三个工具补充清晰的名称、描述和参数说明
- [ ] 抽取 `src/tools/result.ts`，统一成功与失败结果格式
- [ ] 保持工具处理器与 MCP 注册逻辑分离，方便单元测试

验收：三个工具都能被列出、参数校验生效、错误能作为工具结果返回。

### 第 5 步：手写 MCP Client

- [ ] 创建 `src/client.ts`
- [ ] 使用 `Client` 和 `StdioClientTransport` 启动本项目 Server
- [ ] 调用 `listTools()` 输出工具名称和输入 Schema
- [ ] 使用 `callTool()` 分别调用三个工具
- [ ] 调用完成后关闭 Client 和子进程

学习产出：亲眼看到 MCP Client 完成进程启动、协议握手、能力发现和工具调用。

### 第 6 步：使用 Inspector 和真实 Host 验证

- [ ] 使用 MCP Inspector 连接本地 stdio Server
- [ ] 在 Inspector 中查看并调用三个工具
- [ ] 选择一个真实 Host，配置本地 MCP Server
- [ ] 让 Host 中的模型自主选择并调用工具回答代码问题
- [ ] 记录至少一次成功调用和一次参数错误

Inspector 验证命令将在 Server 完成后加入 `package.json`，形式如下：

```bash
npx @modelcontextprotocol/inspector npx tsx src/server.ts
```

### 第 7 步：补测试与安全边界

- [ ] 单元测试三个工具适配器
- [ ] 测试输入 Schema 拒绝非法参数
- [ ] 测试目录穿越和敏感文件访问仍被拒绝
- [ ] 编写 Client/Server stdio 集成测试，至少覆盖 `tools/list` 和一次 `tools/call`
- [ ] 检查源码中没有会污染 stdout 的 `console.log`
- [ ] 为超长工具结果增加截断策略

验收：`npm test` 和 `npm run typecheck` 全部通过。

### 第 8 步：与项目 04 的 Function Calling 对比

- [ ] 对比 OpenAI Tool Definition 与 MCP Tool Schema
- [ ] 对比项目 04 的 `executeTool()` 与 MCP 的 `tools/call`
- [ ] 解释为什么 MCP Server 本身不等于 Agent
- [ ] 记录复用 MCP 后，Host、Agent 和工具实现之间的职责变化
- [ ] 在 `notes.md` 写出最终学习总结

学习产出：能够判断一个能力应该直接写成 Agent 内部工具，还是独立暴露为 MCP Server。

## 可选进阶（完成最小闭环后再做）

- [ ] 增加 `grep` 和 `search_docs`
- [ ] 把项目说明暴露为 Resource
- [ ] 提供代码审查 Prompt 模板
- [ ] 增加 Streamable HTTP 传输
- [ ] 增加会话、鉴权、限流和审计日志
- [ ] 接入项目 05，为 MCP 工具选择和结果质量建立回归评估

## 目标目录结构

```text
07-mcp-dev-tools/
├── README.md
├── notes.md
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # 当前准备阶段占位入口
│   ├── server.ts             # 第 2 步创建
│   ├── client.ts             # 第 5 步创建
│   └── tools/
│       ├── list-files.ts
│       ├── read-file.ts
│       ├── search-code.ts
│       └── result.ts
└── tests/
    ├── tools.test.ts
    └── stdio.integration.test.ts
```

## 完成标准

以下条件全部满足，才算完成项目 07 的核心学习：

- Server 能通过 stdio 完成初始化和能力发现
- Client、Inspector、至少一个真实 Host 都能调用工具
- 三个只读工具复用项目 04 的安全实现，没有复制核心逻辑
- 非法参数、目录穿越和敏感文件访问都有测试
- 能清楚解释 MCP 与 Function Calling、Agent、普通 HTTP API 的区别
- 完成一次真实问题演示并在 `notes.md` 记录调用链

## 官方资料

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [构建第一个 MCP Server](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-server.md)
- [构建第一个 MCP Client](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-client.md)
- [stdio 传输](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/stdio.md)
