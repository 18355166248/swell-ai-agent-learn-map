# 项目 05：Agent Evaluation Lab

> 对应学习阶段：Phase 2A / Week 9+
> 当前状态：eval runner 已实现，评估任务集已就绪，待启动服务执行第一轮手工评估

## 这是什么

这是一个专门用来评估 RAG 和 Agent 质量的实验项目。

它的目标不是回答用户问题，而是回答另一个更基础的问题：

**当前系统到底有没有变好？**

## 为什么要单独做这个项目

到现在为止，仓库里已经有：

- `02-doc-rag`：知识检索能力
- `03-req-analyst`：真实场景下的结构化分析
- `04-dev-copilot`：多步工具调用 Agent

但还缺一层：

- 固定任务集
- 成功标准
- 失败分类
- 回归比较

没有这层，后面继续调 Prompt、加 Memory、放开写操作，都会越来越不可控。

## 项目目标

第一阶段只做最小评估闭环：

- 读取一组固定任务
- 调用现有系统得到结果
- 记录答案、引用来源、工具轨迹
- 标记成功 / 失败
- 输出一份可复盘报告

## 计划评估的对象

| 对象                      | 关注点                             |
| ------------------------- | ---------------------------------- |
| `projects/02-doc-rag`     | 检索命中率、引用准确性、回答相关性 |
| `projects/03-req-analyst` | 结构化字段完整性、风险点覆盖度     |
| `projects/04-dev-copilot` | 任务完成度、工具调用顺序、边界行为 |

## 使用方式

```bash
# 确保三个目标服务已启动（02-doc-rag:8081 / 03-req-analyst:8082 / 04-dev-copilot:8083）

# 单独运行某类评估
npm run eval:rag          # 仅 RAG 评估
npm run eval:agent        # 仅 Agent 评估
npm run eval:req          # 仅 Req-Analyst 评估

# 运行全量评估
npm run eval:all
```

结果输出到 `reports/round-1-{type}.json`。

## 目录结构

```text
05-agent-eval/
├── README.md
├── package.json
├── tasks/                 # 任务集副本 / 自定义任务
├── reports/               # 评估报告输出（JSON + Markdown）
│   └── report-template.md # 报告模板
└── src/
    ├── schema.ts          # 评估结果类型定义
    ├── config.ts          # 服务地址与路径配置
    ├── runner.ts          # 评估执行逻辑
    └── cli.ts             # CLI 入口

## 当前不急着做的事

- 自动化 LLM 裁判
- 复杂可视化报表
- 大规模 benchmark 平台

先把一套最小可复盘评估流程跑通，比一次把平台做大更重要。
```
