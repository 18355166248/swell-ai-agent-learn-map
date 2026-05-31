# Week 10：Phase 2B · Memory

**时间**：2026-05-31
**状态**：✅ 完成

## 本周目标

> 给 Agent 加上对话记忆，从"无状态单次问答"升级为"有记忆持续协作"。

## 这一周要解决的问题

- Agent 如何记住上一轮聊了什么
- 如何在不过度消耗上下文窗口的前提下注入历史
- 如何让记忆的增删改查成为独立模块
- 如何在 Server / CLI 两端都支持和复用

## 实际完成情况

| 天   | 目标                                                   | 完成？ |
| ---- | ------------------------------------------------------ | ------ |
| 周日 | MemoryStore 实现 + runAgent 集成 + Server/CLI 端点扩展 | ✅     |

## 核心交付

| 文件                                               | 职责                                                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `projects/04-dev-copilot/src/agent/memory.ts`      | MemoryStore：创建/追加/列表/删除/格式化历史上下文                                                     |
| `projects/04-dev-copilot/src/agent/memory.test.ts` | 8 个单元测试，覆盖完整 CRUD + 格式化逻辑                                                              |
| `projects/04-dev-copilot/src/agent/index.ts`       | AgentOptions 新增 `conversationId`，AgentResult 返回 `conversationId` + `conversation`                |
| `projects/04-dev-copilot/src/agent/prompts.ts`     | System Prompt 新增 🧠 对话记忆 段落                                                                   |
| `projects/04-dev-copilot/src/server.ts`            | 新增 `GET /api/conversations` / `DELETE /api/conversations/:id`，两个 Agent 端点支持 `conversationId` |
| `projects/04-dev-copilot/cli.ts`                   | 新增 `--conversation-id` / `-c` 参数                                                                  |

## 架构设计

```
用户请求（task + conversationId?）
  │
  ▼
runAgent(task, { conversationId })
  │
  ├─ 1. 如果 conversationId 存在 → getConversation() 加载历史
  │      如果不存在 → createConversation() 创建新会话
  │
  ├─ 2. formatHistoryContext() 将历史格式化为系统级上下文
  │      注入到 messages[1]（system prompt 之后、user task 之前）
  │
  ├─ 3. 正常 ReAct 循环执行
  │
  └─ 4. 完成后 appendTurn() 保存本轮 Q&A
        返回 conversationId 供客户端下次继续
```

### 记忆存储格式 (`.data/conversations/{id}.json`)

```json
{
  "id": "m2x3k...",
  "title": "分析项目有哪些工具函数",
  "createdAt": "2026-05-31T...",
  "updatedAt": "2026-05-31T...",
  "turns": [
    {
      "task": "这个项目有哪些工具？",
      "answer": "分析结论：共5个工具...",
      "timestamp": "2026-05-31T...",
      "stepsSummary": "list_files → read_file → search_code"
    }
  ]
}
```

### 历史注入格式（Agent 看到的 messages）

```
messages = [
  { role: "system", content: "<SYSTEM_PROMPT>" },
  { role: "system", content: "## 📝 对话历史（当前会话已进行 2 轮）
                            以下是本轮之前的历史记录...
                            ### 第 1 轮
                            **用户问题**：有哪些工具？
                            **你的回答**：共5个工具...
                            ### 第 2 轮
                            **用户问题**：read_file 怎么防目录穿越？
                            **你的回答**：safePath 通过..." },
  { role: "user", content: "<当前任务>" },
]
```

## 设计决策

### 为什么存储回答而不是完整 messages 数组

- 完整 messages 包含 tool_calls + tool results（每条最多 8000 字符），存几轮就爆炸
- 回答本身已经是精炼过的结论，天然是"记忆摘要"
- 节省 I/O 和上下文窗口

### 为什么不需要额外 LLM 调用做摘要

- Agent 的最终回答已经是结构化输出（"分析结论：..."），可以直接作为记忆
- 避免增加延迟和费用
- 后续如果需要更强的记忆压缩，可以在 appendTurn 之前加摘要步骤

### 为什么用文件存储而不是 SQLite

- 保持与其他项目一致的技术栈（02-doc-rag 也用的文件 + JSON）
- 文件可直接查看和调试
- 现阶段会话量很小，不需要 DB 级别的并发和查询能力

## API 变更

### POST /api/agent

```json
// Request
{ "task": "...", "conversationId": "m2x3k..." }

// Response
{
  "answer": "...",
  "steps": [...],
  "iterations": 3,
  "conversationId": "m2x3k..."
}
```

### GET /api/agent/stream

```
GET /api/agent/stream?task=...&conversationId=m2x3k...
```

SSE `done` 事件中新增 `conversationId` 字段。

### GET /api/conversations（新增）

```json
[{ "id": "...", "title": "...", "turnCount": 2, "createdAt": "...", "updatedAt": "..." }]
```

### DELETE /api/conversations/:id（新增）

```json
{ "deleted": true }
```

## 测试覆盖

```
memory.test.ts (8 tests)
  ✓ creates a new conversation with an id
  ✓ appends turns to a conversation
  ✓ supports multi-turn conversations
  ✓ lists conversations sorted by updatedAt desc
  ✓ formats history context for Agent injection
  ✓ returns null for empty history
  ✓ deletes a conversation
  ✓ returns null for non-existent conversation
```

根仓库 + 04-dev-copilot：**238 + 39 = 277 个测试全部通过**

## 完成判断

Week 10 完成标准已满足：

- ✅ Agent 可以记住上一轮对话并在此基础上回答
- ✅ Memory 存储独立于 Agent 循环，职责清晰
- ✅ Server 提供完整的 CRUD API
- ✅ CLI 支持 `--conversation-id` 继续会话
- ✅ System Prompt 让 LLM 理解"对话记忆"的含义
- ✅ 全量测试通过，无回归
