# LangGraph vs 手写 ReAct Agent 对比实验

> 状态：🟡 待执行（API 代理暂时不可用，待恢复后运行）

## 实验目标

用同一套评估任务集（`experiments/agent-evals/agent-eval-round-01.json`）分别跑两版 Agent，从多个维度产出结构化对比，回答"什么时候手写更好？什么时候框架更好？"

## 对比对象

| 对象         | 路径                                                          | 核心代码行数                                                      |
| ------------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| 手写版       | `projects/04-dev-copilot/src/agent/`                          | 483（index.ts）+ 124（registry.ts）+ 164（memory.ts）= **771 行** |
| LangGraph 版 | `projects/06-langgraph-copilot/src/agent.ts` + `src/tools.ts` | **~150 行**（agent.ts）+ **~80 行**（tools.ts）= **~230 行**      |

## 对比维度

- [ ] **通过率**：5 个评估任务（agent-002 ~ agent-006）各自是否能通过 keypoint 检查
- [ ] **迭代次数**：每个任务需要多少轮 LLM 调用
- [ ] **Token 消耗**：prompt tokens + completion tokens
- [ ] **答案质量**：关键点覆盖率、结构清晰度
- [ ] **代码量**：核心 Agent 逻辑的收敛比例

## 评估任务集

| 任务 ID   | 难度 | 类型   | 期望工具              |
| --------- | ---- | ------ | --------------------- |
| agent-002 | 简单 | 单工具 | search_docs           |
| agent-003 | 中等 | 多工具 | list_files, read_file |
| agent-004 | 困难 | 多工具 | read_file（多次）     |
| agent-005 | 中等 | 边界   | 无（约束检查）        |
| agent-006 | 中等 | 单工具 | read_file             |

## 运行方式

```bash
# 手写版
npx tsx experiments/langgraph-vs-handwritten/runner.ts --engine handwritten --task agent-002

# LangGraph 版
npx tsx experiments/langgraph-vs-handwritten/runner.ts --engine langgraph --task agent-002

# 全量对比
npx tsx experiments/langgraph-vs-handwritten/runner.ts --all
```

## 结果文件

- `round-01-results.json`：两版对每个任务的详细运行数据
- `round-01-summary.md`：结构化对比总结

## 预判（待验证）

基于代码静态分析，预判 LangGraph 版：

1. **代码量**：核心逻辑收敛 ~70%（483 行 → ~60 行图定义）
2. **通过率**：应与手写版持平（底层 LLM 和工具相同）
3. **Token 消耗**：应该相似（messages 数组结构一致）
4. **内存管理**：MemorySaver 存完整 state 比手写版 Q&A 摘要消耗更多内存，但上下文更完整
5. **工具参数归一化**：LangGraph 版暂未实现 `normalizeToolArgsForTask`，可能影响搜索范围精度

## 最终判断（待填写）

> 什么时候手写更好？什么时候框架更好？
>
> 这是整个 Week 11 最重要的结论。
