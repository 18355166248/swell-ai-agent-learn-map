# Week 7: 04-dev-copilot — Agent + Tool Calling 实施方案

## Context

`projects/04-dev-copilot/` 当前只有目录骨架（README + .gitkeep），需要从零搭建。
目标：实现一个 ReAct Agent，用户输入任务 → LLM 自主调用只读工具多步推理 → 输出结构化分析结果。

核心复用：

- `02-doc-rag` 暴露的 `doc-rag` workspace 公共接口（检索 / RAG 能力）
- `03-req-analyst` 的知识库向量索引
- 所有项目共享的 dotenv / Express / OpenAI SDK / tsx 模式

## 架构总览

```
cli.ts ("描述需求")               浏览器 (Web UI)
      │                                │
      └──────── runAgent() ────────────┘
                   │
          ┌────────┴────────┐
    Agent Loop (ReAct)    Tool Registry (5 tools)
    - 最多 10 轮迭代        - readFile / listFiles
    - OpenAI function       - searchCode / grep
      calling               - searchDocs (RAG 集成)
    - 事件流输出            - 全部只读 + 路径安全
```

## 文件结构

```
04-dev-copilot/
├── cli.ts                          # CLI 入口
├── package.json                    # 项目配置
├── tsconfig.json                   # TS 配置
├── src/
│   ├── agent/
│   │   ├── index.ts                # Agent 主循环 (ReAct)
│   │   ├── prompts.ts              # 系统 Prompt
│   │   └── tools/
│   │       ├── registry.ts         # 工具注册表
│   │       ├── readFile.ts         # 读文件
│   │       ├── listFiles.ts        # 列目录
│   │       ├── searchCode.ts       # 关键词搜索代码
│   │       ├── searchDocs.ts       # RAG 文档检索
│   │       └── grep.ts             # 正则搜索
│   └── server.ts                   # Express Web 服务
├── public/
│   └── index.html                  # 聊天式 Web UI
└── .data/                          # 向量索引（gitignore）
```

## 技术规格

### 依赖与配置

- **package.json**: name=`dev-copilot`, `"type":"module"`, deps=`dotenv/express/openai`, devDeps=`tsx/typescript/@types/*`
- **tsconfig.json**: 基于 `02-doc-rag/tsconfig.json`，当前不依赖跨目录源码 import
- **端口**: `COPILOT_PORT || 8083`
- **模型**: `openai/gpt-oss-120b:free`（OpenRouter）
- **temperature**: 0.3
- **max_tokens**: 2048
- **dotenv**: 先加载 `../../.env` 再加载 `../.env`（override: false）

### Agent 循环（`src/agent/index.ts`）

```typescript
runAgent(task, { model?, maxIterations=10, onEvent?, silent? }): Promise<AgentResult>

AgentResult { answer: string; steps: AgentStep[]; iterations: number }
AgentStep { iteration; thought; action?; observation?; error? }
AgentStreamEvent { type: "thought"|"tool_call"|"tool_result"|"answer"|"error"; content; iteration }
```

循环逻辑：

1. `messages = [system_prompt, user_task]`
2. while (iteration < maxIterations):
   - `openai.chat.completions.create({ model, messages, tools, temperature: 0.3 })`
   - 如果 `msg.content && !msg.tool_calls` → 最终答案，break
   - 如果 `msg.tool_calls`:
     - push assistant message (content + tool_calls)
     - 顺序执行每个 tool_call
     - push tool result messages
     - 触发 onEvent 回调
     - continue
3. 超限时强制 summarize（无 tools 的最终调用）

关键细节：

- tool result 截断到 8000 字符
- LLM API 错误：指数退避重试 3 次（1s/2s/4s）
- 未知工具名返回错误字符串
- 工具执行异常返回友好错误信息（不抛异常）
- `iterations` 表示 Agent 主循环轮数，不等于工具调用步数

### 5 个工具

| 工具          | 文件          | 核心逻辑                                                            |
| ------------- | ------------- | ------------------------------------------------------------------- |
| `read_file`   | readFile.ts   | fs.readFileSync + 行号切片 + 路径安全检查                           |
| `list_files`  | listFiles.ts  | fs.readdirSync 递归 + path-aware pattern 过滤 + 跳过 node_modules   |
| `search_code` | searchCode.ts | 关键词匹配 .ts/.tsx/.js 文件 + 返回 file:line:content               |
| `grep`        | grep.ts       | `new RegExp(pattern, "i")` + 上下文行                               |
| `search_docs` | searchDocs.ts | RAG: rewriteQuery → getEmbedding → retrieve + BM25 → hybridRetrieve |

补充约束：

- 所有文件工具共享同一套 `safePath()` 判定，使用规范化绝对路径 + `relative()` 防目录穿越
- 禁止读取项目根目录同前缀的兄弟目录（如 `04-dev-copilot-sibling`）

### 工具注册表（`src/agent/tools/registry.ts`）

```typescript
// 简单 map 模式，不用 class
const toolMap: Record<string, (root: string) => ToolExecutor> = { ... }

getToolDefinitions(): AgentTool[]        // OpenAI format 工具定义
getToolExecutor(name, root): ToolExecutor
executeTool(name, args, root): Promise<string>   // 带错误包装
```

### searchDocs 集成细节

- 向量加载：模块级懒加载缓存，合并 02-doc-rag + 03-req-analyst 两个向量库
- 检索管道：通过 `doc-rag` workspace 公共接口调用共享检索能力
- 返回格式：带来源路径和相似度分数的文档片段
- 优雅降级：无索引文件时返回明确提示

### CLI（`cli.ts`）

```bash
tsx cli.ts "帮我分析这个需求需要改哪些文件"
tsx cli.ts --model openai/gpt-4o "任务描述"
tsx cli.ts --max-iterations 5 "任务描述"
```

- 手动 process.argv 解析（不用 commander/yargs）
- 彩色终端输出：💭 思考 / 🔧 工具调用 / ✅ 最终答案 / ❌ 错误
- 项目根目录自动检测（向上找 package.json name=swell-ai-agent-learn-map）

### Server + Web UI

- Express 服务（完全复用 03-req-analyst 模式）
- `POST /api/agent` — 同步模式，返回完整 AgentResult
- `GET /api/agent/stream?task=...` — SSE 流式模式，实时推送工具执行轨迹与最终答案
- `GET /api/health` — 健康检查

Web UI：

- 聊天式界面，左侧输入右侧 Agent 工具轨迹输出
- EventSource (SSE) 实时展示工具调用、返回结果、最终答案
- 工具调用卡片可折叠展开
- 4 个预设示例按钮
- 复用 03-req-analyst 的 CSS 设计语言（渐变标题、卡片式布局）

## 实施顺序

### Phase 1: 项目骨架

1. `package.json` + `tsconfig.json` + 目录结构

### Phase 2: 5 个工具（无 LLM 依赖）

2. `src/agent/tools/readFile.ts`
3. `src/agent/tools/listFiles.ts`
4. `src/agent/tools/grep.ts`
5. `src/agent/tools/searchCode.ts`
6. `src/agent/tools/searchDocs.ts`（集成 RAG）

### Phase 3: Agent 基础设施

7. `src/agent/tools/registry.ts`（工具注册表）
8. `src/agent/prompts.ts`（系统 Prompt）
9. `src/agent/index.ts`（ReAct 循环核心）

### Phase 4: 入口

10. `cli.ts`（CLI 入口）
11. `src/server.ts`（Express 服务）
12. `public/index.html`（Web UI）

## 验证方案

1. **工具单元测试**：`vitest run` 测试路径安全、目录 pattern 过滤、文件工具边界
2. **Agent 循环测试**：mock OpenAI SDK，验证多 tool call 场景下的 `iterations` 语义
3. **手动冒烟测试**：
   ```bash
   cd projects/04-dev-copilot
   npm run cli "分析这个项目有哪些工具函数"
   npm run cli "查看 README 内容"
   npm start
   # 浏览器访问 http://localhost:8083，用预设示例测试
   ```
4. **端到端测试**：真实需求 → Agent 自动分析 → 检查工具调用轨迹是否合理
