# Week 11：LangGraph 入门

> 时间：2026-06-01 – 2026-06-07
> 状态：🟡 进行中

## 本周目标

- [ ] 理解 LangGraph 核心概念：StateGraph / Node / Edge / ConditionalEdge
- [ ] 用 LangGraph 重写 dev-copilot 的 ReAct 循环
- [ ] 迁移自建 Tool Registry 到 LangChain Tool 封装
- [ ] 对比手写版和 LangGraph 版的代码复杂度、可读性、可测试性
- [ ] 用评估体系跑同一套任务集，对比两版通过率

## 技术选型理由

10 周手写积累后，引入 LangGraph 解决以下问题：

- 手写 ReAct 循环在条件路由下越来越复杂
- Human-in-the-loop 确认逻辑无法在 ReAct 循环里优雅表达
- 需要框架级的状态持久化来对比自建 MemoryStore

## 项目产物

- `projects/06-langgraph-copilot/`（新建）
- `experiments/langgraph-vs-handwritten/`（对比实验）

## 参考资料

- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [LangGraph Quick Start](https://langchain-ai.github.io/langgraph/tutorials/introduction/)
