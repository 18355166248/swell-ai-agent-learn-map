# AI 学习地图

> 目标：用 8 周时间，把 Prompt、LLM API、Embedding、RAG、Agent 这条 AI 应用工程路径真正走一遍，并沉淀每一阶段的学习结论与演进步骤。

## 当前状态

- 当前日期：2026-05-29
- 当前阶段：Week 8 完成
- 当前重点：归档 8 周学习闭环，并为后续阶段预留扩展方向

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

这个仓库目前分成两类内容：

- 已有内容：8 周路线图、Week 1–7 周文档、4 个阶段项目、基础测试与构建配置
- 当前已完成：Week 8 复盘文档、演进总结、分享材料与最终状态收口

### 当前仓库结构

```text
swell-ai-agent-learn-map/
├── README.md
├── ROADMAP.md
├── PROGRESS.md
├── weeks/                  # 每周计划与笔记模板
├── projects/               # 项目目录和项目 README
├── experiments/            # 实验记录模板与数据集
├── docs/                   # 概念索引、术语、技术决策、参考资料
└── shared/                 # 共享模块目录骨架
```

### 目标结构

下面这些内容属于后续可继续扩展的方向，不代表当前 8 周闭环必须全部完成：

- `docs/concepts/*.md`：按主题沉淀核心概念笔记
- `projects/*/src`：各阶段项目实现代码
- `shared/llm`、`shared/embedding`、`shared/utils`：跨项目复用模块

## 快速导航

| 我想看什么 | 去哪里                         |
| ---------- | ------------------------------ |
| 本周任务   | `weeks/week-XX/README.md`      |
| 每周笔记   | `weeks/week-XX/notes.md`       |
| 整体路线   | `ROADMAP.md`                   |
| 当前进度   | `PROGRESS.md`                  |
| 技术决策   | `docs/decisions/tech-stack.md` |
| 概念现状   | `docs/concepts/README.md`      |
| 实验记录   | `experiments/`                 |

## 最终目标

最终产物不只是某一个项目，而是一条完整的学习与落地路径。其中阶段项目用于承接不同周次的目标，最终汇合成对 AI 应用工程的系统理解。落地能力包括：

- 对内部文档建立索引并支持问答
- 检索规范、SDK、组件文档并附带引用来源
- 输入需求后输出开发方案、风险点和测试点
- 结合代码检索和文档检索完成多步分析

## 技术栈取舍

| 层级       | 选择                                                     |
| ---------- | -------------------------------------------------------- |
| 第一优先级 | TypeScript、Node.js、OpenAI SDK、Embedding、RAG Pipeline |
| 第二优先级 | LangChain / LlamaIndex、pgvector、MCP、Agent Workflow    |
| 暂不投入   | 模型训练、微调、GPU 部署                                 |
