# Week 9 笔记

## 当前阶段判断

✅ 完成（启动日期：2026-05-29，完成日期：2026-05-31）

评估体系已完整搭建并经过 7 轮迭代验证，`04-dev-copilot` Agent 在 round 4 达到 5/5=100%。评估引擎稳定，后续可随时按 `--round=N --model=xxx` 回归重跑。

## 本周想回答的问题

- 什么叫"RAG 变好了"？
- 什么叫"Agent 完成了任务"？
- 什么叫"系统只是看起来能用"？

## 评估边界（周一定范围）

第一轮评估覆盖三个项目，各自关注不同的维度：

### 02-doc-rag → RAG 类评估

- 检索命中：给定问题，预期来源文档是否出现在检索结果中
- 引用准确：回答中引用的来源是否和检索结果一致
- 回答相关性：答案是否直接回应了问题，而不是泛泛而谈

### 03-req-analyst → 结构化输出评估

- 字段完整性：六个分析维度（页面改动点/接口依赖/埋点需求/风险点/测试点/方案建议）是否都有实质内容
- 规范引用：分析中引用的规范条目是否准确可追溯
- 场景适配：输出是否针对输入需求的业务场景，而非套用模板

### 04-dev-copilot → Agent 类评估

- 任务完成度：多步分析是否得出了有效结论
- 工具路径：工具选择和调用顺序是否合理（如：先 search_docs 了解背景 → 再 read_file 确认细节 → 最后 search_code 定位影响范围）
- 边界行为：是否在只读约束内运行，有无尝试超出权限的操作

## 本周第一步

- [x] 从 `02-doc-rag` 的真实文档中抽取第一批 RAG 评估任务（8 个任务，simple/medium/hard 各覆盖）
- [x] 在 `experiments/agent-evals/` 下创建 `rag-eval-round-01.json`
- [x] 从 `04-dev-copilot` 的真实分析场景中抽取第一批 Agent 评估任务（5 个任务，single-tool/multi-tool/boundary 各覆盖）
- [x] 在 `experiments/agent-evals/` 下创建 `agent-eval-round-01.json`
- [x] 决定 `03-req-analyst` 的结构化评估纳入第一轮（3 组任务，含 5 个输入场景）
- [x] 在 `experiments/agent-evals/` 下创建 `req-analyst-eval-round-01.json`

### Round 1 RAG 任务覆盖

8 个任务与已有的 `experiments/chunk-strategies/eval-dataset.json`（10 题）互补：

| ID      | 难度   | 类别       | 目标文档                                |
| ------- | ------ | ---------- | --------------------------------------- |
| rag-002 | simple | factual    | auth-flow.md                            |
| rag-003 | simple | factual    | component-library.md                    |
| rag-004 | simple | factual    | deploy-cicd.md                          |
| rag-005 | medium | procedural | upload-cdn.md                           |
| rag-006 | medium | rule       | project-react-rules.md                  |
| rag-007 | medium | procedural | deploy-cicd.md                          |
| rag-008 | hard   | cross-doc  | project-react-rules + component-library |
| rag-009 | hard   | rule       | project-react-rules.md                  |

### Round 1 Agent 任务覆盖

5 个任务基于 `04-dev-copilot` 的真实工具集（read_file / list_files / search_code / grep / search_docs）设计：

| ID        | 难度   | 类别        | 核心工具             | 考察点                |
| --------- | ------ | ----------- | -------------------- | --------------------- |
| agent-002 | simple | single-tool | search_docs          | 单工具调用 + 来源引用 |
| agent-003 | medium | multi-tool  | list_files+read_file | 两步组合：概览 → 详细 |
| agent-004 | hard   | multi-tool  | read_file（≥3次）    | 深层调用链追踪 + 综合 |
| agent-005 | medium | boundary    | System Prompt 约束   | 拒绝写操作请求        |
| agent-006 | simple | boundary    | safePath 安全层      | 拒绝路径穿越攻击      |

### Round 1 Req-Analyst 任务覆盖

3 组任务（5 个输入场景），基于 `03-req-analyst` 的六个分析维度和 5 份内部规范设计：

| ID      | 难度   | 类别                | 场景                            | 考察点                         |
| ------- | ------ | ------------------- | ------------------------------- | ------------------------------ |
| req-002 | medium | field-completeness  | 优惠券选择功能（预设 1）        | 六维度字段是否都有实质内容     |
| req-003 | medium | spec-accuracy       | 分享功能优化（预设 2）          | 规范引用是否真实可追溯         |
| req-004 | hard   | scenario-adaptation | 多优惠券组合（C2 规则冲突变体） | 是否识别与现有规范的冲突       |
| req-005 | hard   | scenario-adaptation | 直播间礼物打赏（C1 泛化边界）   | 超出知识库时是否合理推理不编造 |
| req-006 | hard   | scenario-adaptation | 支付+分享联动（C3 跨域协同）    | 是否同时覆盖两个领域的规范     |

## 预计会产出的东西

- [x] RAG 评估任务集（Round 1）— `rag-eval-round-01.json`（8 任务）
- [x] Agent 评估任务集（Round 1）— `agent-eval-round-01.json`（5 任务）
- [x] Req-Analyst 评估任务集（Round 1）— `req-analyst-eval-round-01.json`（5 场景）
- [x] 评估结果 Schema — `projects/05-agent-eval/src/schema.ts`
- [x] 评估报告模板 — `projects/05-agent-eval/reports/report-template.md`
- [x] Eval Runner — `projects/05-agent-eval/src/runner.ts` + `cli.ts`（支持 rag/agent/req-analyst/all 四种模式）
- [x] 第一版评估结果与失败分类记录（已完成 7 轮 Agent 评估 + 首轮 RAG/Req-Analyst 评估）
- [x] Week 9 总结（决定 Week 10 进入 Memory，评估体系就绪）

## 过程中要特别注意

- 不要一开始就追求自动评分全覆盖
- 先把任务定义和失败分类说清楚
- 评估集最好来自真实任务，而不是纯概念题
- 每个失败案例都标注具体原因（属于五种分类中的哪一种），不做笼统的"不够好"

## Week 9 总结

### 评估体系的成果

经过 3 天集中搭建和 7 轮迭代，`05-agent-eval` 已经是一个可以长期使用的回归工具：

- **架构**：`schema.ts`（类型）→ `runner.ts`（执行逻辑）→ `cli.ts`（CLI 入口），三层清晰
- **任务覆盖**：RAG 8 + Agent 5 + Req-Analyst 5 场景，simple/medium/hard 各有覆盖
- **评分维度**：`keypoint_coverage` / `task_completed` / `tool_path_ok` / `constraint_ok`，正交不重叠
- **失败分类**：9 种 failureType，每个失败案例都能定位到具体原因
- **回归能力**：自动加载上一轮报告，计算 `newFailures` / `newPasses` / `passRateDelta`

### 7 轮 Agent 评估的关键发现

| Round | 通过率     | 关键变化                                                |
| ----- | ---------- | ------------------------------------------------------- |
| 1     | 3/5 (60%)  | 初始基线，工具选择出错 + 约束穿透                       |
| 2-3   | 3/5 (60%)  | 收紧 Prompt 后安全约束改善，但工具清单类问题仍不稳定    |
| 4     | 5/5 (100%) | 要求 `list_files → read_file(registry.ts)` 代码路径生效 |
| 5-6   | —          | Prompt 微调，拒绝话术收敛                               |
| 7     | 4/5 (80%)  | maxTokens=2048 导致输出截断，非能力问题                 |

核心结论：

1. **工具清单类问题需要代码路径约束** — 让 Agent"先读 registry.ts"比让它"列出所有工具"更稳定
2. **安全约束需要双重保障** — System Prompt 层面 + safePath 代码层面，两者互补
3. **token 限制影响评估公平性** — 应该对长输出任务使用更大的 maxTokens

### 对 Week 10 的判断

Week 10 应该进入 **Memory（对话记忆）**：

- 评估体系已经就绪，后续任何变更都有回归基线
- Agent 目前是"无状态"的，每次对话独立——加入 Memory 后每次变更都有评估能验证是否退化
- 这是从"单次智能"到"持续协作"的关键一步
