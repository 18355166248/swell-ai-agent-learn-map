# AI 学习地图 — 前端工程师的 AI 应用工程之路

> **目标**：2 个月内，做出一个能读取公司/项目文档，辅助完成需求分析、代码生成、规范查询的 RAG + Agent 工具。

## 我是谁

前端客户端工程师，已有自动化工具开发经验，目标是把 AI 接进真实的前端研发流程。

## 学习方向

不从"算法 RAG"入手，而是从**能落地的 AI 应用工程**出发：

```
Prompt 基础 → LLM API 调用 → Embedding/向量检索
→ RAG 基础问答 → 接入真实文档 → 优化检索效果
→ Agent + 工具调用 → 结合前端开发流程落地
```

## 项目结构

```
swell-ai-agent-learn-map/
├── README.md               # 本文件
├── ROADMAP.md              # 8 周路线图 + 里程碑
├── PROGRESS.md             # 每周进度追踪（每周更新）
│
├── weeks/                  # 按周组织的学习任务
│   ├── week-01/            # Prompt 基础 + CLI 工具
│   ├── week-02/            # LLM API + 文件问答
│   ├── week-03/            # Embedding + 向量检索
│   ├── week-04/            # RAG 完整 Demo
│   ├── week-05/            # RAG 效果优化
│   ├── week-06/            # 接入真实场景
│   ├── week-07/            # Agent + 工具调用
│   └── week-08/            # 整合收尾 + 技术分享
│
├── projects/               # 核心实践项目（可独立运行）
│   ├── 01-ai-code-explain/ # 代码解释器 CLI
│   ├── 02-doc-rag/         # 文档 RAG 问答系统
│   ├── 03-req-analyst/     # 需求分析助手
│   └── 04-dev-copilot/     # 最终作品：前端研发知识库助手
│
├── experiments/            # 实验与对比记录
│   ├── chunk-strategies/   # 不同切分策略对比
│   ├── prompt-templates/   # Prompt 模板库
│   └── retrieval-methods/  # 检索方法对比
│
├── docs/                   # 学习笔记与参考资料
│   ├── concepts/           # 核心概念笔记
│   ├── references/         # 外部资源索引
│   └── decisions/          # 技术选型记录
│
└── shared/                 # 跨项目共用代码
    ├── llm/                # LLM 调用封装
    ├── embedding/          # Embedding 工具
    └── utils/              # 通用工具
```

## 快速导航

| 我想看…      | 去哪里                          |
| ------------ | ------------------------------- |
| 本周要做什么 | `weeks/week-XX/README.md`       |
| 整体进度     | `PROGRESS.md`                   |
| 8 周计划     | `ROADMAP.md`                    |
| 某个项目代码 | `projects/0X-xxx/`              |
| 概念笔记     | `docs/concepts/`                |
| Prompt 模板  | `experiments/prompt-templates/` |

## 最终交付物

```
前端研发知识库助手（AI Dev Copilot for Frontend Workflow）

能力：
  ✓ 上传内部文档并建立索引
  ✓ 自然语言检索规范/SDK/组件文档
  ✓ 输入需求自动生成开发方案
  ✓ 代码文件检索与解释
  ✓ 回答时附带引用来源
```

## 技术栈

| 阶段       | 技术                                                     |
| ---------- | -------------------------------------------------------- |
| 第一优先级 | TypeScript, Node.js, OpenAI SDK, Embedding, RAG Pipeline |
| 第二优先级 | LangChain/LlamaIndex, pgvector, MCP, Agent Workflow      |
| 暂缓       | 模型训练、微调、GPU 部署                                 |
