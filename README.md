# AI Native 学习成长地图

> 目标：把这个仓库做成一份持续演进的 AI Native / AI Agent 学习记录，不只保存代码产物，也记录每一阶段的认知变化、技术判断和成长路径。

## 当前状态

- 当前日期：2026-06-01
- 当前阶段：Week 11 启动 — LangGraph 入门，为 Human-in-the-loop 做准备
- 当前重点：用 LangGraph `StateGraph` 重写手写 ReAct 循环，对比两版差异

## 这个仓库到底在记录什么

这不是一个单纯的“AI 工具合集”仓库，而是一个带阶段产物的成长记录仓库：

- `weeks/` 记录每周推进过程
- `projects/` 记录阶段性可运行产物
- `experiments/` 记录效果验证和方法对比
- `docs/stages/` 记录每一阶段真正学会了什么

也就是说，这个仓库的核心不是“最后做出了哪个工具”，而是“我是怎么一步步学到 AI Native / AI Agent 的”。

## 学习路径

不从“算法研究”切入，而是按可落地的 AI 应用工程路径推进：

```text
Prompt 基础
→ LLM API 调用
→ Embedding / 向量检索
→ RAG 问答
→ 接入真实文档
→ 检索优化
→ Agent + 工具调用
→ 结合前端开发流程落地
```

## 仓库说明

这个仓库目前分成四层内容：

- 学习推进层：`weeks/`
- 阶段产物层：`projects/`
- 方法实验层：`experiments/`
- 认知沉淀层：`docs/`

### 当前仓库结构

```text
swell-ai-agent-learn-map/
├── README.md
├── ROADMAP.md
├── PROGRESS.md
├── weeks/                  # 每周计划与笔记模板
├── projects/               # 阶段项目：每一阶段的可运行产物
├── experiments/            # 实验记录：效果对比、检索优化、Prompt 尝试
├── docs/                   # 概念、阶段总结、技术决策、参考资料
└── shared/                 # 共享模块目录骨架
```

### 目标结构

下面这些内容属于后续可继续扩展的方向，不代表第一阶段闭环必须全部完成：

- `docs/concepts/*.md`：按主题沉淀核心概念笔记
- `docs/stages/*.md`：按阶段沉淀“学会了什么 / 为什么会进入下一阶段”
- `projects/*/src`：各阶段项目实现代码
- `shared/llm`、`shared/embedding`、`shared/utils`：跨项目复用模块

## 快速导航

| 我想看什么   | 去哪里                         |
| ------------ | ------------------------------ |
| 本周任务     | `weeks/week-XX/README.md`      |
| 每周笔记     | `weeks/week-XX/notes.md`       |
| 整体路线     | `ROADMAP.md`                   |
| 当前进度     | `PROGRESS.md`                  |
| 阶段总结     | `docs/stages/README.md`        |
| 下一阶段方向 | `docs/next-phase-direction.md` |
| 技术决策     | `docs/decisions/tech-stack.md` |
| 概念现状     | `docs/concepts/README.md`      |
| 实验记录     | `experiments/`                 |
| 下一阶段路线 | `ROADMAP.md`                   |

## 当前推荐阅读顺序

如果第一次看这个仓库，建议先看“成长路径”，再看“阶段项目”：

1. [README.md](./README.md)
2. [docs/learning-summary.md](./docs/learning-summary.md)
3. [docs/stages/README.md](./docs/stages/README.md)
4. [docs/next-phase-direction.md](./docs/next-phase-direction.md)
5. [ROADMAP.md](./ROADMAP.md)
6. 最后再看 `projects/01` 到 `projects/05`

## 最终目标

最终产物不只是某一个项目，而是一条完整的学习与落地路径。其中阶段项目用于承接不同周次的目标，最终汇合成对 AI 应用工程的系统理解。落地能力包括：

- 对内部文档建立索引并支持问答
- 检索规范、SDK、组件文档并附带引用来源
- 输入需求后输出开发方案、风险点和测试点
- 结合代码检索和文档检索完成多步分析

## 下一阶段建议

当前处于 Phase 2C 的技术铺垫阶段，先引入 LangGraph 再进入 Human-in-the-loop：

1. `LangGraph 入门`（Week 11）：用 `StateGraph` 重写 Agent ReAct 循环，对比手写版差异
2. `Human-in-the-loop`（Week 12）：`interrupt()` + `Command` 实现人机确认流
3. `安全写操作`（Week 13）：审批式写操作 + diff review + 回滚
4. `Workflow`（Phase 2D）：`StateGraph` 编排完整研发链路

> 详细规划见 `ROADMAP.md` 和 `docs/next-phase-direction.md`

## 技术栈取舍

| 层级       | 选择                                                                          |
| ---------- | ----------------------------------------------------------------------------- |
| 第一优先级 | TypeScript、Node.js、OpenAI SDK、LangGraph、Embedding、RAG Pipeline           |
| 第二优先级 | pgvector、MCP、LangChain（仅取 Tool/Message 基类，不碰 Chain/Retriever 抽象） |
| 暂不投入   | 模型训练、微调、GPU 部署、LlamaIndex、多 Agent 编排框架                       |

> 技术选型理由：经过 10 周手写 ReAct/MemoryStore/ToolRegistry/Eval 积累，底层原理已充分理解。Week 11 起引入 LangGraph 作为编排框架，解决手写状态机在 Human-in-the-loop 和 Workflow 场景的复杂度问题。LangChain 仅在 LangGraph 需要其 Tool/Message 基类时接触，不主动学习其 Chain/Retriever 抽象（已有更好的自建实现）。
