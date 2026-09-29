# 项目 06：LangGraph Dev Copilot

> 对应阶段：Week 11 · LangGraph 入门
> 当前状态：核心学习闭环已完成；包含 8 段渐进练习、完整 ReAct Agent、CLI、SSE 服务和跨进程会话持久化

## 这是什么

这是项目 04 手写 ReAct Agent 的 LangGraph 版本。

项目 04 通过 `for` 循环、消息数组和分支判断手动完成：

```text
LLM 决策 → 判断 tool_calls → 执行工具 → 回填结果 → 继续循环 → 输出答案
```

本项目将同一套逻辑改写成一个有状态图：

```text
START
  ↓
agent（调用 LLM）
  ↓
shouldContinue
  ├─ 有 tool_calls → tools（ToolNode）→ agent
  └─ 无 tool_calls → END
```

重点不是“换一个框架调用模型”，而是理解手写状态机如何映射为：

- `MessagesAnnotation`：保存并追加消息状态
- `StateGraph`：声明节点和边
- `ToolNode`：执行模型返回的工具调用
- `addConditionalEdges()`：根据状态决定继续循环还是结束
- `recursionLimit`：限制图的最大执行步数
- `Checkpointer`：按 `thread_id` 保存和恢复图状态
- `stream()`：按状态、节点更新或消息 Token 输出执行过程

## 与项目 04 的对应关系

| 手写 ReAct Agent               | LangGraph 版本                         |
| ------------------------------ | -------------------------------------- |
| `messages.push(...)`           | `MessagesAnnotation` reducer           |
| 调用 OpenAI/Anthropic SDK      | 图中的 `agent` 节点                    |
| `if (msg.tool_calls)`          | `shouldContinue()`                     |
| `executeTool()` 和工具消息构造 | `ToolNode`                             |
| `for`、`continue`、`break`     | 普通边、条件边、`END`                  |
| `maxIterations`                | `recursionLimit`                       |
| 手工注入历史消息               | Checkpointer 根据 `thread_id` 恢复状态 |
| `onEvent` 回调                 | `graph.stream()` 异步迭代器            |
| 自建工具 JSON Schema           | `DynamicStructuredTool` + Zod          |
| 项目 04 的只读工具实现         | 继续复用，不重复实现                   |

## 当前已实现能力

- [x] `StateGraph` 基础节点、边、状态和编译流程
- [x] `MessagesAnnotation` 消息 reducer
- [x] LLM 节点与多轮消息
- [x] `DynamicStructuredTool` 和 `ToolNode`
- [x] 完整的 ReAct 条件循环
- [x] 五个只读开发工具
- [x] `values`、`updates`、`messages` 三种流模式演示
- [x] `MemorySaver` 和多 `thread_id` 隔离演示
- [x] JSON 文件检查点持久化
- [x] 非流式 CLI 和流式 CLI
- [x] HTTP JSON 接口和 SSE 接口
- [ ] Human-in-the-loop：`interrupt()` / `Command`
- [ ] 写操作审批、diff review 和回滚
- [ ] 自动化单元测试与集成测试

## 建议学习顺序

不要直接从完整的 `src/agent.ts` 开始。建议按 8 段练习逐步建立心智模型，每次只引入一个新概念。

### 第 1 段：图、节点、边和部分状态更新

```bash
npx tsx src/segment-01/step-01-single-node.ts
npx tsx src/segment-01/step-02-two-nodes.ts
npx tsx src/segment-01/step-03-check-understanding.ts
```

学习重点：

- `Annotation.Root()` 如何声明状态
- `addNode()` 和 `addEdge()` 的职责
- 节点为什么只返回需要修改的部分状态
- 边的顺序为什么决定数据流向

完成标准：不看示例，能写一个三节点的纯函数图。

### 第 2 段：compile 与 invoke 生命周期

```bash
npx tsx src/segment-02/step-01-compile-once.ts
npx tsx src/segment-02/step-02-trace-state.ts
```

学习重点：

- 建图和编译为什么是两个阶段
- 编译后的图为什么可以多次 `invoke()`
- state 如何在节点之间逐步变化

完成标准：能解释 builder、compiled graph 和一次 invocation 的区别。

### 第 3 段：消息 reducer

```bash
npx tsx src/segment-03/step-01-reducer.ts
npx tsx src/segment-03/step-02-why-reducer.ts
```

学习重点：

- 普通字段默认覆盖，消息字段为什么需要追加
- `MessagesAnnotation` 如何替代手写的多次 `messages.push()`
- reducer 与 Checkpointer 是不同层次的能力

完成标准：能解释为什么没有消息 reducer 就无法形成 ReAct 上下文。

### 第 4 段：把 LLM 放入节点

```bash
npx tsx src/segment-04/step-01-first-llm-node.ts
npx tsx src/segment-04/step-02-multi-turn.ts
```

学习重点：

- 节点内调用 `llm.invoke()`
- AI 消息如何写回 graph state
- 在没有 Checkpointer 时，如何手动携带上一轮消息

这一段开始需要模型环境变量，详见“环境变量”章节。

### 第 5 段：Tool Calling 定义

```bash
npx tsx src/segment-05/step-01-bind-tools.ts
npx tsx src/segment-05/step-02-compare-tool-defs.ts
```

学习重点：

- `bindTools()` 只让模型获得工具定义，不负责执行工具
- 模型返回的 `tool_calls` 包含什么
- 手写 JSON Schema 与 `DynamicStructuredTool + Zod` 的差异

完成标准：能区分“模型选择工具”和“程序执行工具”。

### 第 6 段：ToolNode 执行工具

```bash
npx tsx src/segment-06/step-01-test-tool-alone.ts
npx tsx src/segment-06/step-02-tool-node-in-graph.ts
```

学习重点：

- 工具为什么应该能够脱离 Agent 单独测试
- `ToolNode` 如何读取 `tool_calls`、匹配工具并产生 `ToolMessage`
- Zod 参数校验发生在哪一层

完成标准：能独立测试工具，也能把同一个工具交给 `ToolNode` 执行。

### 第 7 段：条件边和完整 ReAct 图

```bash
npx tsx src/segment-07/step-01-conditional-edge.ts
npx tsx src/segment-07/step-02-should-continue.ts
npx tsx src/segment-07/step-03-react-graph.ts
```

学习重点：

- `addConditionalEdges()` 如何表达分支和循环
- `shouldContinue()` 如何代替手写 `if/else`
- `agent → tools → agent` 为什么就是 ReAct 循环
- `recursionLimit` 计算的是图执行步数，不等于工具调用次数

完成标准：能够从空文件写出两节点 ReAct 图，并说明每条边的意义。

### 第 8 段：流式输出与会话状态

```bash
# 流式输出
npx tsx src/segment-08/step-stream-01-modes.ts
npx tsx src/segment-08/step-stream-02-sse.ts

# Checkpointer 与 thread
npx tsx src/segment-08/step-memory-01-basics.ts
npx tsx src/segment-08/step-memory-02-threads.ts
```

学习重点：

- `values`：每一步后的完整 state
- `updates`：节点本次产生的增量
- `messages`：消息或 Token 级输出
- `MemorySaver` 保存的是完整 graph state，不只是问答摘要
- 相同 `thread_id` 恢复上下文，不同 `thread_id` 相互隔离

完成标准：能根据 UI 需求选择流模式，并能解释 invocation、thread 和 checkpoint 的关系。

### 最后：阅读完整实现

按以下顺序阅读：

1. `src/tools.ts`：手写工具如何包装成 LangChain Tool
2. `src/agent.ts`：完整 ReAct 图和公开 API
3. `src/json-file-saver.ts`：跨进程检查点持久化
4. `cli.ts`：CLI 如何调用和流式消费图
5. `src/server.ts`：如何将图暴露为 JSON API 和 SSE

## 快速开始

### 1. 安装依赖

从仓库根目录执行：

```bash
npm install
cd projects/06-langgraph-copilot
```

### 2. 配置环境变量

项目会先读取仓库根目录 `.env`，再读取本项目 `.env`。

完整 Agent（`src/agent.ts`、CLI、Server）使用 Anthropic 兼容配置：

```dotenv
ANTHROPIC_API_KEY=your-key
ANTHROPIC_BASE_URL=https://your-gateway.example.com
ANTHROPIC_MODEL_NAME=your-model
```

第 4～8 段中的部分教学脚本使用 `ChatOpenAI`：

```dotenv
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://your-gateway.example.com/v1
OPENAI_MODEL_NAME=your-model
```

注意：主程序与教学脚本使用了不同 Provider 适配器。只运行完整 Agent 时配置 Anthropic 变量即可；按顺序运行全部练习时，两组变量都需要可用。

### 3. 类型检查

```bash
npx tsc --noEmit
```

当前源码类型检查通过。项目暂时没有 `*.test.ts` 或 `*.spec.ts`，因此 `npm test` 会提示没有测试文件并以失败状态退出。

## 运行完整 CLI

### 普通模式

```bash
npm run cli -- "分析 projects/06-langgraph-copilot 的结构"
```

### 展示每个节点的执行过程

```bash
npm run cli -- --stream "这个项目有哪些工具？"
```

这里的 `--stream` 使用 `streamMode: "updates"`，展示工具调用、工具结果和最终答案，不是逐 Token 打字机输出。

### 延续已有会话

首次运行结束后会输出或生成一个 thread ID。后续传入同一个 ID：

```bash
npm run cli -- --thread thread-001 "先分析这个项目的工具"
npm run cli -- --thread thread-001 "继续说明这些工具如何接入 ToolNode"
```

CLI 状态保存在：

```text
.checkpoints/cli-state.json
```

## 启动 HTTP / SSE 服务

```bash
npm start
```

默认地址为 `http://localhost:8084`，可通过 `COPILOT_PORT` 修改端口。

### 健康检查

```bash
curl http://localhost:8084/api/health
```

### 非流式调用

```bash
curl -X POST http://localhost:8084/api/agent \
  -H 'Content-Type: application/json' \
  -d '{"task":"分析 projects/06-langgraph-copilot 的工具结构"}'
```

响应示例：

```json
{
  "answer": "...",
  "messageCount": 8,
  "threadId": "..."
}
```

将返回的 `threadId` 随下一次请求传入即可延续会话：

```json
{
  "task": "继续分析条件路由",
  "threadId": "上一轮返回的 threadId"
}
```

### SSE 调用

```bash
curl -N --get http://localhost:8084/api/agent/stream \
  --data-urlencode 'task=分析这个项目的 ReAct 图'
```

SSE 事件类型：

| 事件     | 含义                            |
| -------- | ------------------------------- |
| `step`   | Agent 产生工具调用              |
| `result` | ToolNode 返回工具结果预览       |
| `answer` | Agent 输出最终答案              |
| `done`   | 图执行结束，同时返回 `threadId` |
| `error`  | 图执行或模型调用失败            |

Server 状态保存在：

```text
.checkpoints/server-state.json
```

CLI 和 Server 使用不同的检查点文件，thread 状态不会自动互通。

## 可用工具

完整 Agent 在 `src/tools.ts` 中注册了五个只读工具，并复用 `projects/04-dev-copilot` 的底层实现：

| 工具          | 用途                               |
| ------------- | ---------------------------------- |
| `read_file`   | 读取文件，支持起止行               |
| `list_files`  | 递归列出目录，可按文件模式过滤     |
| `search_code` | 在代码文件中搜索关键词             |
| `search_docs` | 在内部文档知识库中进行语义检索     |
| `grep`        | 使用正则表达式搜索代码并返回上下文 |

文件工具仍然受项目 04 的路径安全与敏感文件策略约束。Agent 没有写文件和执行 Shell 的工具。

## 核心文件

```text
06-langgraph-copilot/
├── README.md
├── package.json
├── tsconfig.json
├── cli.ts                         # 命令行入口、updates 流式消费、thread 恢复
└── src/
    ├── agent.ts                   # 完整 ReAct 图与公开运行 API
    ├── tools.ts                   # 五个 DynamicStructuredTool
    ├── json-file-saver.ts         # JSON 文件持久化 Checkpointer
    ├── server.ts                  # POST JSON + GET SSE 服务
    ├── segment-01/                # State、节点和边
    ├── segment-02/                # compile / invoke 生命周期
    ├── segment-03/                # Messages reducer
    ├── segment-04/                # LLM 节点和多轮消息
    ├── segment-05/                # bindTools 与工具定义
    ├── segment-06/                # DynamicStructuredTool 与 ToolNode
    ├── segment-07/                # 条件边和完整 ReAct 循环
    └── segment-08/                # stream、SSE、MemorySaver、threads
```

## JsonFileSaver 的设计

LangGraph 的 `MemorySaver` 只保存在当前进程内。`JsonFileSaver` 继承它，并增加：

- 启动时从 JSON 文件恢复 `storage` 和 `writes`
- `Uint8Array` 使用 Base64 序列化
- 每次 `put()` / `putWrites()` 后写入文件
- 先写 `.tmp` 再 `rename`，降低中途退出导致文件损坏的风险
- 检查点文件损坏时备份为 `.corrupted-{timestamp}`，然后从空状态启动

它适合学习和本地单进程演示，不应直接作为生产数据库：

- 使用同步文件 I/O
- 没有多进程并发锁
- 继承并依赖 `MemorySaver` 的内部存储结构
- 没有容量清理、版本迁移和访问控制

生产环境应选择 LangGraph 支持的持久化 Checkpointer 或独立数据库实现。

## 当前限制与下一步

### 当前限制

- 尚无自动化测试；`npm test` 当前不会通过
- 尚未实现 `interrupt()`、`Command` 和人工审批恢复
- Agent 只读，不能修改代码或执行命令
- `JsonFileSaver` 仅面向本地学习，不适合多实例部署
- 达到 `recursionLimit` 时由 LangGraph 抛错，没有手写版的强制总结兜底
- `search_docs` 是否可用取决于项目 02 的索引和外部 Embedding 环境
- 教学脚本与完整 Agent 的模型 Provider 配置尚未统一

### 建议下一步

1. 为工具包装、条件路由和 `JsonFileSaver` 增加 Vitest
2. 使用 `interrupt()` + `Command` 实现 Human-in-the-loop
3. 为写操作增加审批、diff 预览和回滚
4. 用项目 05 的评估集对比手写版与 LangGraph 版
5. 根据真实 UI 需求选择 `updates` 或 `messages` 流模式

## 学完标准

满足以下条件，可以认为本项目的 LangGraph 基础已经掌握：

- 能从零写出一个 `StateGraph` 并解释 state、node、edge
- 能说明 `MessagesAnnotation` reducer 与 Checkpointer 的区别
- 能解释 `bindTools()`、`ToolNode` 和条件边各负责什么
- 能从零写出 `agent → tools → agent` ReAct 循环
- 能使用 `thread_id` 延续会话并隔离多个会话
- 能根据场景选择 `invoke()` 或不同的 `streamMode`
- 能说清楚 LangGraph 相比手写循环减少了什么，又引入了什么约束
