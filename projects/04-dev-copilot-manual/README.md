# 项目 04（手搓版）：AI Dev Copilot — 从零实现 ReAct Agent

> 参考实现：`projects/04-dev-copilot`（先不看源码，按步骤自己写，卡住再对照）
> 当前状态：**阶段 1 工具层已完成**（含进阶的 searchDocs），下一步阶段 2 Agent 循环

## 这是什么

不借助 LangGraph 等框架，**手写**一个 ReAct Agent：

```
用户任务 → LLM 决策 → 调用只读工具（读文件/搜代码/查文档）→ 观察结果 → 继续推理 → 最终答案
```

通过手搓理解三个核心机制：

1. **Tool Calling 协议** — 如何把工具以 JSON Schema 暴露给模型，如何解析 `tool_calls`
2. **ReAct 循环** — messages 数组的状态流转（assistant → tool → assistant → ...）
3. **工程健壮性** — 路径安全、重试、超时、结果截断、强制总结

## 实现步骤（按顺序，每步可独立验证）

### 阶段 1：工具层（纯 Node，不碰 LLM）

- [x] **1. `src/agent/tools/pathSafety.ts`** — 所有文件工具的地基
  - `safePath(target, projectRoot)`：相对路径 → 规范化绝对路径
  - 用 `path.relative()` 判断是否越出根目录（防 `../../` 目录穿越）
  - 敏感文件黑名单：`.env*`、`.git/`、`*.pem/*.key` 等
  - ✅ 验收：`safePath("../../etc/passwd", root)` 抛错；`.env` 抛错；正常路径返回绝对路径
- [x] **2. `src/agent/tools/readFile.ts`** — 读文件
  - 基于 `safePath` + `readFileSync`
  - 支持 `startLine`/`endLine` 切片（1-based，含端点），输出带行号
  - ✅ 验收：读自身 `package.json`；切片 1-3 行；越界路径报错
- [x] **3. `src/agent/tools/listFiles.ts`** — 列目录
  - 递归 `readdirSync`，跳过 `node_modules`/`.git` 等
  - 支持 `pattern` 过滤（如 `*.ts`）
  - ✅ 验收：列 `src/` 只见 ts 文件；pattern 过滤生效
- [x] **4. `src/agent/tools/searchCode.ts` + `grep.ts`** — 搜索
  - searchCode：关键词匹配 `.ts/.tsx/.js/.json`，返回 `file:line:content`
  - grep：`new RegExp(pattern)` 正则匹配 + 上下文行
  - ✅ 验收：搜 `safePath` 能命中 pathSafety.ts
- [x] **5. `src/agent/tools/registry.ts`** — 工具注册表
  - `toolFactories: Record<string, (root) => ToolExecutor>` map 模式
  - `getToolDefinitions()`：OpenAI function calling 格式的 JSON Schema 定义
  - `executeTool(name, args, root)`：未知工具/执行异常都返回错误字符串，**不抛异常**
  - ✅ 验收：`executeTool("read_file", {path: "package.json"}, root)` 返回内容；未知工具返回错误文案

### 阶段 2：Agent 循环（核心）

- [ ] **6. `src/agent/prompts.ts`** — 系统 Prompt
  - 定义角色（代码分析助手）、工具使用规范、最终答案输出格式
- [ ] **7. `src/agent/index.ts`** — 最小 ReAct 循环（先跑通，不加健壮性）
  - `runAgent(task, options): Promise<AgentResult>`
  - messages = `[system, user]` → 循环调 `client.chat.completions.create({ messages, tools })`
  - 三分支：① 有 content 无 tool_calls → 最终答案 break；② 有 tool_calls → push assistant 消息 → 逐个执行 → push `role: "tool"` 消息（带 `tool_call_id`）→ continue；③ 都没有 → break
  - 达到 maxIterations：追加一条 user 消息「请基于以上结果总结」，**不带 tools** 再调一次
  - 环境变量：`ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL_NAME`（OpenAI 兼容协议）
  - dotenv 先加载仓库根 `.env` 再加载项目 `.env`（override: false）
  - ✅ 验收：`npx tsx` 临时脚本跑「分析这个项目有哪些工具函数」，能看到完整工具调用链
- [ ] **8. 健壮性增强**（在 7 基础上迭代）
  - tool result 超 8000 字符截断
  - LLM 调用指数退避重试 3 次（1s/2s/4s）
  - AbortController 全局超时（默认 300s）
  - `onEvent` 回调：`thought / tool_call / tool_result / answer / error` 事件流
  - `AgentStep { iteration, thought, action, observation }` 记录轨迹
  - ✅ 验收：CLI 输出每轮迭代的工具名、耗时、token 用量

### 阶段 3：入口层

- [ ] **9. `cli.ts`** — CLI 入口
  - 手动 `process.argv` 解析（`--model` / `--max-iterations`），不用 commander
  - 彩色输出：💭 思考 / 🔧 工具调用 / ✅ 答案
  - 项目根目录自动检测（向上找 `package.json` name 为 `swell-ai-agent-learn-map`）
- [ ] **10. `src/server.ts` + `public/index.html`** — Web 入口
  - `POST /api/agent` 同步接口 + `GET /api/agent/stream` SSE 流式（复用 `onEvent`）
  - 聊天式 UI，工具调用轨迹卡片可折叠
  - ✅ 验收：浏览器提问，实时看到工具轨迹和最终答案

### 阶段 4：进阶（可选）

- [x] **11. `src/agent/tools/searchDocs.ts`** — RAG 文档检索（已实现；embedding 网关 404 时由 `executeTool` 包装为错误字符串返回，属环境限制）
  - 通过 `doc-rag` workspace 包复用 02 的检索能力，合并 02/03 两个向量库
- [ ] **12. `src/agent/memory.ts`** — 会话记忆
  - JSON 文件持久化 + 历史上下文注入为第二条 system 消息
- [ ] **13. 测试** — Vitest
  - 路径安全边界、pattern 过滤、mock OpenAI SDK 验证多 tool call 轮次语义

## 快速开始

```bash
cd projects/04-dev-copilot-manual
npm install          # 安装依赖（含 doc-rag workspace 链接）

# 从步骤 1 开始写 pathSafety.ts，用临时脚本验证：
npx tsx -e "import { safePath } from './src/agent/tools/pathSafety.js'; console.log(safePath('package.json', process.cwd()))"
```

环境要求（根目录 `.env`）：

- `ANTHROPIC_API_KEY` — 必填
- `ANTHROPIC_BASE_URL` — 使用兼容网关时配置
- `ANTHROPIC_MODEL_NAME` — 建议显式指定稳定模型

## 关键设计决策（先想清楚再动手）

| 决策点            | 参考做法                                       |
| ----------------- | ---------------------------------------------- |
| 工具注册          | 简单 map 工厂函数，不用 class                  |
| 工具出错          | 返回错误字符串让 LLM 自己纠错，不中断循环      |
| 路径安全          | 所有文件工具共享同一个 `safePath()`            |
| `iterations` 语义 | Agent 主循环轮数，≠ 工具调用步数               |
| 流式输出          | 不暴露模型原始思维链，只展示工具轨迹与最终答案 |
