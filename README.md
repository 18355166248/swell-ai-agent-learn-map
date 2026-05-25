# AI 学习地图

> 目标：在 8 周内，循序完成 Prompt、LLM API、RAG、Agent 的学习和落地，最终做出一个面向前端研发流程的知识库助手。

## 当前状态

- 当前日期：2026-05-25
- 当前阶段：Week 1 已完成，准备进入 Week 2
- 当前重点：在 `ai-code-explain` 上补 streaming、长文件处理、`--file` / `--dir` 参数和错误处理

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

- 已有内容：路线图、周计划、项目骨架、Week 1 概念笔记、`ai-code-explain` v1、基础测试与构建配置
- 计划补齐：更多概念笔记正文、后续项目实现代码、Week 2 功能迭代、统一的共享模块

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

下面这些内容是后续 8 周内会逐步补齐的目标，不代表当前已经全部存在：

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

最终产物是一个“前端研发知识库助手”，目标能力包括：

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
