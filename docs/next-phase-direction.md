# 下一阶段方向总纲

> 这份文档的目的不是列功能清单，而是先把方向定准：接下来学什么、为什么先学它、哪些方向现在还不适合直接做。

## 1. 先重申这个仓库的目标

这个仓库的目标不是持续做出更多 AI 工具，而是记录一条清晰的 AI Native / AI Agent 学习成长路径。

所以后面的每一步都应该服务这 3 件事：

1. 继续补齐 AI Native 系统能力
2. 让每一阶段都能产出可验证的结果
3. 把“我为什么这样学、为什么这样做”沉淀成可复盘的方法

如果某个方向只是“看起来更酷”，但不能帮助你建立系统能力或成长记录，就不应该优先做。

## 2. 你现在已经走到哪一步

前 10 周已经完成的能力可以概括成：

- 基础调用：Prompt、LLM API、Streaming、错误处理
- 知识层：Embedding、Chunk、RAG、引用来源、检索优化
- 场景层：真实研发文档接入、结构化需求分析
- 编排层：Tool Calling、ReAct、只读 Agent、多步分析
- 评估层：评估引擎、关键点覆盖率、工具路径验证、约束检测、回归对比
- 记忆层：MemoryStore、会话历史注入/保存、conversationId 对接

这意味着你已经完成了：

- 从”调模型”到”做系统”
- 从”单次回答”到”知识检索”
- 从”知道什么”到”先查什么”
- 从”看起来能用”到”能证明有没有变好”
- 从”一次性任务”到”有记忆持续协作”

10 周的手写积累给了你一个关键优势：**你已经理解了底层原理**。接下来引入 LangGraph 不会变成”只会用框架”，而是”理解原理后选对工具”。

但你还没有完成的是：

- 怎么让系统在真实工作流里可控执行
- 怎么让系统在不确定时主动确认而不是编造
- 怎么用合适的框架解决手写状态机的复杂度问题
- 怎么让系统具备长期可演进性

## 3. 方向池总评估（更新版）

Evaluation 和 Memory 已完成。以下是剩余方向和新技术选型的评估。

### 技术选型：LangGraph

| 维度       | 评估                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| 现在适合度 | `高`                                                                                                            |
| 为什么     | 手写 ReAct + MemoryStore 已充分理解底层原理；进入 Human-in-the-loop 和 Workflow 后，手写状态机会越来越难维护    |
| 核心收益   | `interrupt()` 解决人机确认、`Checkpointer` 解决状态持久化、`StateGraph` 解决多步编排                            |
| 风险       | 低——带着 10 周手写经验看框架，不会”只会用不懂原理”。LangGraph 的 Tool/Message 概念和你手写的一致                |
| 不学什么   | LangChain 的 Chain/Retriever 抽象——你自建的 chunker/embedder/retriever/混合检索更好，LangChain 只取其 Tool 基类 |

### 剩余方向评估

| 方向                  | 现在适合度 | 为什么                                                  |
| --------------------- | ---------- | ------------------------------------------------------- |
| LangGraph 入门        | `最高`     | 当前阶段核心任务，替代手写 ReAct 循环                   |
| Human-in-the-loop     | `最高`     | LangGraph `interrupt()` 天然支持，Week 12 目标          |
| Checkpointer 对比     | `高`       | 拿自建 MemoryStore 和 LangGraph Checkpointer 做设计对比 |
| 审批式写操作          | `高`       | 基于 `interrupt()` 实现，比手写确认逻辑干净得多         |
| diff review           | `高`       | 结合写操作场景做                                        |
| 可回滚 workflow       | `中高`     | `StateGraph` 的分支回退比手写状态机清晰                 |
| 多步研发流程编排      | `中高`     | Phase 2D 目标，`StateGraph` 编排需求分析→方案→审批→文档 |
| Prompt / version 管理 | `中`       | 有价值但非 LangGraph 阶段重点                           |
| Workspace context     | `中`       | 可在 Checkpointer 基础上扩展                            |
| User profile          | `中低`     | 更偏产品层，适合系统面向稳定用户后再补                  |
| 多 Agent 编排         | `低`       | 过早——先吃透单 Agent + LangGraph，再考虑多 Agent        |

## 4. 当前学习路径（已完成 Evaluation + Memory，进入 LangGraph 阶段）

### 第一优先级：LangGraph 入门 → Human-in-the-loop

这是 Week 11–13 的核心任务。

原因很简单：

- 10 周手写积累给了你最好的前提——理解底层原理再引入框架
- 手写 ReAct 循环在条件路由和确认点方面已经力不从心
- LangGraph 的 `interrupt()` 直接解决你手写确认逻辑的痛点
- `Checkpointer` 让你可以对比自建 MemoryStore 理解框架设计取舍

这一段应该重点回答：

- `StateGraph` 如何替代手写 ReAct 循环
- 框架版本和手写版本在代码复杂度上的差异
- 什么情况下手写比框架更好（边界判断能力）
- `interrupt()` + `Command` 的人机协作模式
- `Checkpointer` vs 自建 MemoryStore 的设计差异

### 第二优先级：安全写操作

基于 LangGraph 的 `interrupt()` 实现审批式写操作。

- 审批式写操作（基于 `interrupt()` 卡点）
- diff review + 回滚策略
- 最小权限边界设计
- 评估体系新增写操作约束维度

### 第三优先级：Workflow Integration

用 LangGraph `StateGraph` 编排完整研发链路。

- 需求分析 → 方案草拟 → 人工审批 → 文档生成
- 对比手写编排和 LangGraph 编排的复杂度
- 沉淀”什么时候该用框架、什么时候手写更合适”的判断

### 明确的”不学”清单

| 不学                        | 为什么                                                         |
| --------------------------- | -------------------------------------------------------------- |
| LangChain 的 Chain 抽象     | 你自建的 prompt 链更透明、更可控                               |
| LangChain 的 Retriever 抽象 | 你自建的 BM25 + 混合检索 + RRF 已经更好                        |
| LangChain 的 Agent 抽象     | 直接学 LangGraph 的 Agent，LangChain 只取其 Tool/Message 基类  |
| 多 Agent 编排               | 单 Agent + LangGraph 还没吃透，过早引入多 Agent 只会增加复杂度 |
| LlamaIndex                  | 和 LangChain 同质，没有增量学习价值                            |

## 5. 每个方向具体该学什么

### 5.1 LangGraph 入门（Week 11）

建议拆成 4 个子主题：

1. 核心概念
   - StateGraph / Node / Edge / ConditionalEdge
   - State schema 设计（与手写 messages[] 的对应关系）
   - ToolNode 与手写 Tool Registry 的对比

2. 重写 ReAct 循环
   - 用 `StateGraph` 表达手写 while 循环的逻辑
   - 对比：代码行数、可读性、可测试性
   - 评估体系跑同一套任务集对比通过率

3. 迁移 Tool 层
   - 自建工具注册表 → LangChain Tool 封装
   - 不改工具实现，只换调用接口

4. 对比结论沉淀
   - 什么场景手写更好（简单线性流程）
   - 什么场景框架更好（条件路由、多步分支）

### 5.2 Human-in-the-loop（Week 12）

建议拆成 3 个子主题：

1. 确认点设计
   - 哪些操作必须暂停确认（写文件、发请求、改配置）
   - `interrupt()` 的触发时机和粒度
   - `Command` 恢复执行的模式

2. 前端确认卡片
   - 非纯文本的确认 UI（diff 预览、影响范围）
   - SSE 流式确认状态推送

3. 对比自建确认逻辑
   - 手写版（在 ReAct 里判断 + 轮询等待）vs LangGraph `interrupt()`
   - 记录两种方案的复杂度差异

### 5.3 Checkpointer 对比（Week 12 附带）

1. LangGraph `MemorySaver` vs 自建 MemoryStore
2. `SqliteSaver` 的持久化能力
3. 状态恢复和断点续跑
4. 对比结论：什么时候自建存储更好

### 5.4 安全写操作（Week 13）

建议拆成 3 个子主题：

1. 审批点设计
   - 什么时候必须确认
   - 什么操作可以直接执行

2. 变更展示
   - diff review
   - 风险提示

3. 回滚机制
   - 怎么撤销
   - 怎么恢复到上一步

### 5.5 Workflow Integration（Phase 2D）

建议拆成 2 个子主题：

1. 单条研发链路编排
   - 需求分析 → 方案草拟 → 人工审批 → 文档生成
   - `StateGraph` 的并行节点和条件分支

2. 框架 vs 手写对比
   - 同一链路手写版和 LangGraph 版的代码量、可维护性
   - 最终结论：什么时候该用框架

## 6. 现在最适合你的具体顺序

已完成前两步（Evaluation + Memory），接下来按 LangGraph 主线推进：

1. `LangGraph 入门`（Week 11）：`StateGraph` 重写 ReAct 循环，对比手写版
2. `Human-in-the-loop`（Week 12）：`interrupt()` + `Command` + 确认卡片
3. `安全写操作`（Week 13）：审批式写操作 + diff review + 回滚
4. `Workflow Integration`（Phase 2D）：`StateGraph` 编排完整研发链路

每一步都保持一个核心对比：**手写版 vs LangGraph 版**。这个对比本身就是最有价值的学习产出。

## 7. 当前不建议优先做的东西

下面这些方向不是没价值，而是现在先做容易跑偏：

- 多 Agent 编排（先吃透单 Agent + LangGraph）
- LangChain 的 Chain / Retriever / Agent 抽象（你已有更好实现）
- LlamaIndex（和 LangChain 同质，无增量价值）
- 复杂 Planner / Executor / Critic 架构
- 一上来就做全自动写代码
- 一上来就做通用长期用户画像系统

这些方向都有价值，但都应该建立在 LangGraph 单 Agent 编排已经吃透之后。

## 8. 未来阶段的建议产物

### Phase 2C：LangGraph 入门 → Human-in-the-loop（进行中）

建议产物：

- `projects/06-langgraph-copilot/`（LangGraph 版 Agent）
- 手写版 vs LangGraph 版对比报告（代码量、通过率、可维护性）
- `interrupt()` 确认卡片前端原型
- Checkpointer vs 自建 MemoryStore 设计对比

### Phase 2D：Workflow

建议产物：

- 一条基于 LangGraph `StateGraph` 的完整研发链路
- 从输入需求到产出文档的可演示流程
- “什么时候该用框架”的判断沉淀

## 9. 最终建议

如果只用一句话概括：

你现在最不该做的是继续手写越来越复杂的状态机，或者跳进多 Agent 编排。

你现在最该做的是：**用 10 周积累的底层理解，去学 LangGraph 这个刚好能解决你下一层问题的框架**。

具体来说：

- LangGraph 的 `StateGraph` 替代手写 ReAct → 解决条件路由复杂度
- `interrupt()` → 解决人机确认问题（手写需要状态机 + 轮询，框架一行搞定）
- `Checkpointer` → 对比自建 MemoryStore，理解框架设计取舍
- 评估体系 → 跑同一套任务集，对比手写版和框架版的通过率

最终目标不是”学会用 LangGraph”，而是建立一个关键判断力：**什么时候手写更好，什么时候该用框架**。这个判断力是区别”会用工具的人”和”AI 系统工程师”的分界线。
