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

待补充。

## 第 2 步：最小 MCP Server

待补充。

## 第 3～4 步：只读工具接入

待补充。

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
