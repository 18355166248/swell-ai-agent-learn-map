# 阶段 04：Next

> 更新于 2026-06-01。Evaluation（Week 9）和 Memory（Week 10）已完成，当前进入 LangGraph 阶段。

## 当前阶段：LangGraph 入门（为 Human-in-the-loop 做铺垫）

10 周手写积累完成（Prompt → RAG → Agent → Eval → Memory），底层原理理解充分。

Week 11 起引入 **LangGraph** 作为编排框架。核心理由：

- `StateGraph` 替代手写 ReAct 循环，解决条件路由复杂度
- `interrupt()` 实现人机确认（手写需要状态机 + 轮询，框架一行搞定）
- `Checkpointer` 对比自建 MemoryStore，理解框架设计取舍

## 明确的”不学”清单

| 不学                        | 为什么                                                     |
| --------------------------- | ---------------------------------------------------------- |
| LangChain 的 Chain 抽象     | 自建的 prompt 链更透明、更可控                             |
| LangChain 的 Retriever 抽象 | 自建的 BM25 + 混合检索 + RRF 已经更好                      |
| LangChain 的 Agent 抽象     | 直接学 LangGraph Agent，LangChain 只取其 Tool/Message 基类 |
| LlamaIndex                  | 和 LangChain 同质，无增量学习价值                          |
| 多 Agent 编排               | 单 Agent + LangGraph 还没吃透                              |

## 后续四步路径

1. **LangGraph 入门**（Week 11）：`StateGraph` 重写 ReAct 循环，对比手写版
2. **Human-in-the-loop**（Week 12）：`interrupt()` + `Command` + 确认卡片
3. **安全写操作**（Week 13）：审批式写操作 + diff review + 回滚
4. **Workflow Integration**（Phase 2D）：`StateGraph` 编排完整研发链路

每一步都保持一个核心对比：**手写版 vs LangGraph 版**，产出判断力沉淀。

## 对应仓库落点

建议新增：

- `projects/06-langgraph-copilot/`（LangGraph 版 Agent）
- `weeks/week-11/` 起的周记录
- `experiments/langgraph-vs-handwritten/` 对比实验
