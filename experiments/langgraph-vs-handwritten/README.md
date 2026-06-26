# LangGraph vs 手写 ReAct Agent 对比实验

> 状态：🟡 runner 已实现并验证可跑通，**待在可访问模型的网络环境下产出数据**
>
> `runner.ts` 已完成：直接 import 两版 `runAgent`，复用 `05-agent-eval` 的判分逻辑，
> 归一化为统一 `{ answer, steps, iterations }` 后判分，自动产出 `round-01-results.json`
> （+ 成功时的 `round-01-summary.md`）。已做空跑验证：编排 / 归一化 / 判分 / 落盘全链路正常。
>
> **当前阻断点**：`.env` 配置的模型端点 `deepgate.ximalaya.local`（内网域名）在本机沙箱外返回
> `404 Not Found`。需在公司网络 / VPN 下，或换一个可达的 `MODEL_NAME` + `*_BASE_URL` 后重跑。
> 全部运行失败时 runner 会判定「执行被阻断」，只落带 error 详情的 JSON，不生成对比摘要，
> 避免把 API 故障误记成框架对比结论。

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
# 全量对比（两版各跑 5 题）
npm run eval:compare -- --all
# 或：npx tsx experiments/langgraph-vs-handwritten/runner.ts --all

# 单题对比（两版都跑）
npx tsx experiments/langgraph-vs-handwritten/runner.ts --task agent-002

# 只跑某一版
npx tsx experiments/langgraph-vs-handwritten/runner.ts --engine langgraph --task agent-002
```

> 无需手动启动两版 server——runner 直接 import 两版 `runAgent`（npm workspace 依赖已提升到根）。
> 只需保证 `.env` 里的模型端点可达。

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
