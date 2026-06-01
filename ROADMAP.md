# AI Native 学习路线图

> 开始日期：2026-05-21（第 1 周从这里起算）
> 节奏：工作日 40 分钟/天 + 周末 2-3 小时集中写项目

## 当前判断

前 10 周内容已在 05/21–05/31（实际 11 天）内加速完成，走完了一条从 Prompt 到 RAG、Agent、评估、记忆的最小可运行学习路径。Week 1-2 接近自然周节奏，Week 3-8 在 3 天内高强度压缩完成，Week 9-10 各占 1-2 天。

如果继续往下学，路线不该再简单重复”做一个新工具”，而应该进入第二阶段的后半程——引入合适的框架来解决手写状态机已经力不从心的问题：

- 学 LangGraph 的 StateGraph 编排，而不是继续手写 if/else 状态机
- 学 `interrupt()` 人机确认，而不是在 ReAct 循环里硬塞确认逻辑
- 学 Checkpointer 持久化，对比自建 MemoryStore 理解框架设计的取舍
- 学 Graph 工作流集成，把 Agent 从”回答问题”推进到”参与研发流程”

## 为什么选 LangGraph

经过 10 周手写积累，当前项目已经具备：

- 手写 ReAct 循环（理解 Agent 消息流转）
- 手写 MemoryStore（理解会话持久化本质）
- 手写 Tool Registry（理解工具边界与安全）
- 手写评估体系（理解”变好”的判定标准）

这些底层理解是引入 LangGraph 的最佳前提——不会”只会用框架但不懂原理”。

LangGraph 的四个核心能力直接对应后续需求：

| LangGraph 能力   | 对应项目需求                              |
| ---------------- | ----------------------------------------- |
| `StateGraph`     | 替代手写 ReAct 循环，支持更复杂的条件路由 |
| `interrupt()`    | Human-in-the-loop 确认点（Week 12 目标）  |
| `Checkpointer`   | 替代自建 MemoryStore，支持长对话持久化    |
| `Command` / 分支 | Phase 2D 工作流编排                       |

## 里程碑总览

```
Week 1-2  ████  Prompt 基础 + LLM API 调用        → 产出：ai-code-explain CLI
Week 3-4  ████  Embedding + RAG 完整 Demo          → 产出：本地文档问答系统
Week 5-6  ████  RAG 优化 + 接入真实场景            → 产出：团队文档问答助手
Week 7-8  ████  Agent + 整合收尾                   → 能力：Tool Calling、ReAct、多步分析
```

## 第二阶段里程碑总览

```text
Phase 2A  ████  Evaluation / 评估体系             → 产出：任务集 + 回归评估           ✅ Week 9
Phase 2B  ████  Memory / 会话状态                 → 产出：带记忆的 Agent 原型         ✅ Week 10
Phase 2C  ████  LangGraph → Human-in-the-loop       → 产出：可控人机协作工作流            🟡 Week 11–13
Phase 2D  ████  Workflow / 研发流程集成           → 产出：AI Native 工作流助手        ⬜
```

> Phase 2C 起引入 **LangGraph** 作为核心编排框架。理由：手写 ReAct 循环 + MemoryStore 在 Phase 2A/2B 已充分理解底层原理，进入人机协作和工作流编排后，LangGraph 的 `interrupt()` / `Checkpointer` / `StateGraph` 能直接解决手写状态机的复杂度问题。

---

## 第一阶段：原始计划存档

> Week 1–8 的内容是启动时的初始学习计划，保留作为方法论参考（含原始目标、任务拆分和每日节奏）。实际执行记录见 `weeks/week-XX/notes.md`，阶段复盘见 `docs/stages/README.md`。

## 第 1 周（05/21 - 05/27）：Prompt 基础 + LLM API 初探

**核心问题**：AI 应用不只是"调接口"，它的数据流是什么？

### 学习目标

- [ ] 理解 System Prompt / User Prompt 的区别和作用
- [ ] 掌握 JSON 输出约束（structured output）
- [ ] 了解 Function Calling / Tool Calling 的基本概念
- [ ] 知道 Temperature、max_tokens、context window 的意义

### 实践任务

**项目**：`projects/01-ai-code-explain/`

```bash
npx tsx cli.ts ./src/pages/home/index.tsx
```

输出：

- 这个文件做了什么
- 依赖哪些接口
- 有哪些组件
- 潜在风险

### 每日节奏建议

| 天   | 内容                                              |
| ---- | ------------------------------------------------- |
| 周一 | 读 Prompt 基础概念，写第一个 Hello World API 调用 |
| 周二 | 学 System Prompt，实现"代码总结" Prompt           |
| 周三 | 学 JSON 输出约束，让结果结构化                    |
| 周四 | 读取真实的 .tsx 文件，接入 CLI 参数               |
| 周五 | 打磨 Prompt，整理笔记到 `weeks/week-01/notes.md`  |
| 周末 | 把 CLI 做完整，写 week-01 总结                    |

---

## 第 2 周（05/28 - 06/03）：LLM API 进阶 + 文件问答

**核心问题**：怎么把本地文件内容有效地喂给模型？

### 学习目标

- [x] 掌握 streaming 流式输出
- [x] 理解 token 计算和上下文窗口限制
- [x] 学会处理长文档（简单截断或摘要）
- [x] 熟悉 OpenAI SDK 的错误处理和重试

### 实践任务

**项目**：`projects/01-ai-code-explain/`（升级）

```bash
# 升级1：支持 --file 参数（目标用法，实现后）
npx tsx cli.ts --file ./docs/activity-config.md "这个字段怎么配置"

# 升级2：支持批量分析整个目录（目标用法，实现后）
npx tsx cli.ts --dir ./src/utils "找出所有工具函数的作用"
```

### 每日节奏建议

| 天   | 内容                              |
| ---- | --------------------------------- |
| 周一 | 实现 streaming 输出，体验实时响应 |
| 周二 | 学 token 计数，处理超长文件       |
| 周三 | 支持 Markdown 文档输入            |
| 周四 | 加错误处理和重试逻辑              |
| 周五 | 整理笔记，记录踩坑                |
| 周末 | 完整测试，写 week-02 总结         |

---

## 第 3 周（06/04 - 06/10）：Embedding + 向量检索原理

**核心问题**：为什么不能把所有文档都塞给 AI？RAG 的核心逻辑是什么？

### 学习目标

- [ ] 理解 Embedding（文本 → 数字向量）的概念
- [ ] 知道 Cosine Similarity 怎么算相似度
- [ ] 掌握文档 Chunk 的基本方法（按大小 / 按语义）
- [ ] 能手写一个最简单的内存向量检索

### 实践任务

**项目**：`projects/02-doc-rag/`（开始搭建）

```bash
# 索引文档（向量化并存到本地 JSON）
node index.js ./docs/

# 提问
node ask.js "图片上传 CDN 的流程是什么？"
```

第一版：不用真正的向量数据库，用内存数组 + JSON 文件存储。

### 每日节奏建议

| 天   | 内容                                                     |
| ---- | -------------------------------------------------------- |
| 周一 | 用 OpenAI Embedding API 把一段文字变成向量，打印出来看看 |
| 周二 | 手写 Cosine Similarity，搜索最相似的句子                 |
| 周三 | 实现文档切分（按段落切）                                 |
| 周四 | 把切分好的 chunk 批量 embedding 并存到 JSON              |
| 周五 | 实现检索：输入问题 → 找最相似的 3 个 chunk               |
| 周末 | 把检索结果拼成 Prompt，让模型回答                        |

---

## 第 4 周（06/11 - 06/17）：RAG 完整 Demo

**核心问题**：怎么做出一个真正可用的文档问答系统？

### 学习目标

- [ ] 搭建完整的 RAG Pipeline
- [ ] 做出引用来源展示
- [ ] 加一个最简单的 Web UI

### 实践任务

**项目**：`projects/02-doc-rag/`（完成）

功能：

- 上传 Markdown/TXT 文档
- 自动切分和向量化
- 问答并展示引用来源（精确到哪个文件第几行）
- 基础 Web UI（可以用 Express + 静态 HTML，不要求复杂）

**重点**：一定要做引用来源，这是企业场景的核心价值。

### 每日节奏建议

| 天   | 内容                                          |
| ---- | --------------------------------------------- |
| 周一 | 搭 Express 后端，封装检索接口                 |
| 周二 | 做文件上传和索引 API                          |
| 周三 | 实现完整的 RAG 问答链路                       |
| 周四 | 加引用来源（记录每个 chunk 的来源文件和行号） |
| 周五 | 做最简单的前端页面                            |
| 周末 | 端到端测试，写 week-04 总结                   |

---

## 第 5 周（06/18 - 06/24）：RAG 效果优化

**核心问题**："能跑"和"好用"完全是两回事。

### 学习目标

- [ ] 理解不同 Chunk 策略的差异（固定大小 / 按标题 / 按语义）
- [ ] 学习 Query 改写（让检索更准确）
- [ ] 了解 Hybrid Search（向量 + 关键词）
- [ ] 建立效果评估方法

### 实践任务

**实验**：`experiments/chunk-strategies/`

对比以下几种切分方式在相同问题上的检索效果：

1. 固定 500 字切分
2. 按 Markdown 标题切分
3. 按代码块/接口定义切分

记录每种方式的准确率和召回情况。

### 每日节奏建议

| 天   | 内容                                               |
| ---- | -------------------------------------------------- |
| 周一 | 建立评估数据集（10 个问题 + 预期答案）             |
| 周二 | 实现按标题切分，对比效果                           |
| 周三 | 实现 Query 改写，对比效果                          |
| 周四 | 调研并实现简单的关键词搜索（BM25）                 |
| 周五 | 整理对比结论，写进 `experiments/chunk-strategies/` |
| 周末 | 把最优策略回填进 `projects/02-doc-rag/`            |

---

## 第 6 周（06/25 - 07/01）：接入真实场景

**核心问题**：怎么让工具真正服务于日常开发？

### 学习目标

- [ ] 把真实的团队文档接入 RAG 系统
- [ ] 选定一个高价值场景深入做
- [ ] 学习如何处理非 Markdown 格式文档

### 实践任务

**项目**：`projects/03-req-analyst/`（开始）

选择以下场景之一深入做：

**方案 A（推荐）**：需求分析助手

```
输入：一段需求文本
输出：页面改动点 / 接口依赖 / 埋点需求 / 风险点 / 测试点
```

**方案 B**：代码库问答助手

```
输入："这个活动图片上传逻辑在哪？"
输出：相关文件列表 + 代码片段
```

### 每日节奏建议

| 天   | 内容                                      |
| ---- | ----------------------------------------- |
| 周一 | 收集真实文档（把内部文档整理成 Markdown） |
| 周二 | 建立文档索引，测试检索效果                |
| 周三 | 设计需求分析的 Prompt 结构                |
| 周四 | 实现结构化输出（JSON 格式的分析结果）     |
| 周五 | 测试真实需求，打磨输出质量                |
| 周末 | 完善项目，写 week-06 总结                 |

---

## 第 7 周（07/02 - 07/08）：Agent + 工具调用

**核心问题**：RAG 让 AI "知道"，Agent 让 AI "去做"。

### 学习目标

- [ ] 理解 Tool Calling 的机制
- [ ] 学会定义和注册工具（读文件、搜代码、执行命令）
- [ ] 实现多步骤任务拆解
- [ ] 了解安全限制（只读 vs 可写）

### 实践任务

**项目**：`projects/04-dev-copilot/`（开始）

```bash
dev-agent "帮我分析这个需求需要改哪些文件"
```

Agent 工具集（第一版只做只读工具，不要直接改代码）：

- `read_file(path)` — 读取文件内容
- `search_code(query)` — 搜索代码文件
- `search_docs(query)` — 查询内部文档
- `list_files(dir)` — 列出目录

### 每日节奏建议

| 天   | 内容                                   |
| ---- | -------------------------------------- |
| 周一 | 学 Tool Calling，写第一个工具          |
| 周二 | 实现 read_file + search_code 工具      |
| 周三 | 实现多工具组合（Agent 自己决定用哪个） |
| 周四 | 连接 RAG 文档检索工具                  |
| 周五 | 端到端测试：输入需求 → Agent 自动分析  |
| 周末 | 完善，写 week-07 总结                  |

---

## 第 8 周（07/09 - 07/15）：整合收尾 + 第一阶段闭环

**目标**：将前 7 周的能力串联成一条完整链路，并归档学习成果与可复用判断。

### 学习目标

- [ ] 整合前 7 周所有能力
- [ ] 打磨用户体验和输出质量
- [ ] 写技术总结文档
- [ ] 准备技术分享 PPT（可选）

### 实践任务

**完成 `projects/04-dev-copilot/`**

整合验证点（四条学习线的汇合检查）：

- [ ] Prompt 线：结构化需求分析 → 方案草拟 → 测试点整理，形成连贯链路
- [ ] RAG 线：文档索引 → 带来源引用的检索问答 → 检索优化结论回填
- [ ] Agent 线：多工具组合（读文件 + 搜代码 + 搜文档）→ 多步分析闭环
- [ ] 分享线：学习总结 + 技术分享材料 + 可复盘的方法论沉淀

### 每日节奏建议

| 天        | 内容                                 |
| --------- | ------------------------------------ |
| 周一-周二 | 功能整合，消灭 bug                   |
| 周三      | 写项目 README 和使用文档             |
| 周四      | 写学习总结（8 周收获 / 踩坑 / 心得） |
| 周五      | 准备技术分享材料                     |
| 周末      | 最终演示，归档                       |

---

## Phase 2A（Evaluation）✅ 已完成 · Week 9

**核心问题**：怎么证明 RAG / Agent 真的变好了，而不是”看起来能用”？

> 详细记录见 `weeks/week-09/notes.md` 和 `PROGRESS.md`

主要交付：

- `projects/05-agent-eval/` 评估引擎（schema + runner + CLI）
- 关键点覆盖率引擎 / 工具路径验证 / 约束检测 / 回归对比
- 7 轮 Agent 评估迭代（round 1: 60% → round 4: 100% → round 7: 80%）

---

## Phase 2B（Memory）✅ 已完成 · Week 10

**核心问题**：怎么让 Agent 不只是一次性任务执行器，而是能持续记住上下文？

> 详细记录见 `weeks/week-10/notes.md` 和 `PROGRESS.md`

主要交付：

- MemoryStore（文件 JSON 存储 + CRUD + 历史格式化）
- runAgent 自动注入/保存对话历史
- Server / CLI 两端 conversationId 对接
- 277 测试全量通过

---

## 当前阶段：Phase 2C — LangGraph 入门（Human-in-the-loop 技术铺垫）🟡 进行中

**核心问题**：怎么用 LangGraph `StateGraph` 替代手写 ReAct 循环，为 Week 12 的人机确认流打基础？

### LangGraph 学习路径

```text
Week 11: LangGraph 基础
  → StateGraph / Node / Edge / ConditionalEdge
  → 用 LangGraph 重写 dev-copilot 的 ReAct 循环
  → 对比手写版和 LangGraph 版的差异

Week 12: Human-in-the-loop
  → interrupt() 确认点设计
  → Command 恢复执行
  → Checkpointer 对比自建 MemoryStore
  → 前端确认卡片 UI

Week 13: 安全写操作
  → 审批式写操作
  → diff review + 回滚
  → 评估体系新增约束维度
```

### 实践任务

**项目**：`projects/06-langgraph-copilot/`（新建）

```bash
# 用 LangGraph 重写的 Agent，带确认流
langgraph-copilot “帮我新增一个埋点” --confirm
```

核心对比点：

- `StateGraph` vs 手写 ReAct 循环的复杂度差异
- `interrupt()` vs 在 ReAct 里硬塞确认逻辑的差异
- `Checkpointer` vs 自建 MemoryStore 的设计取舍
- 评估体系跑同一套任务集，对比手写版和 LangGraph 版的通过率

---

## Phase 2D（Workflow Integration）⬜

**核心问题**：怎么把 Agent 嵌进真实研发流程？

用 LangGraph `StateGraph` 编排一条完整研发链路：

```text
需求输入 → 分析(节点1) → 方案草拟(节点2)
  → interrupt(人工审批)
  → 文档生成(节点3) → 测试点整理(节点4)
```

对比手写编排和 LangGraph 编排的差异，沉淀”什么时候该用框架”的判断。

---

## 检查点（每周五自问）

- [ ] 本周的代码是否提交了？
- [ ] 笔记是否写在 `weeks/week-XX/notes.md`？
- [ ] `PROGRESS.md` 是否更新了？
- [ ] 有没有踩坑需要记录在 `experiments/` 里？
