# Agent / RAG / Req-Analyst 评估实验

> 这一组实验不再回答"功能有没有做出来"，而是回答"系统到底有没有变好"。

## 这组实验关注什么

从 Phase 2A 开始，实验重点从"检索策略对比"扩展到"任务完成质量评估"。

这里会逐步积累两类东西：

- 任务集（固定问题 + 预期标准）
- 评估结果（每轮报告 + 回归对比）

## 评估对象

### 1. RAG 类任务（`02-doc-rag`）

关注：

- 检索到的来源是否正确（`retrieval_hit`）
- 引用是否准确（`citation_ok`）
- 关键点覆盖率是否足够（`keypoint_coverage`）
- 回答是否和问题真正相关（`task_completed`）

### 2. Agent 类任务（`04-dev-copilot`）

关注：

- 最终任务是否完成（`task_completed`）
- 是否调用了正确工具（`tool_path_ok`）
- 工具顺序是否合理
- 是否触发了不该触发的边界行为（`constraint_ok`）
- 关键点覆盖率（`keypoint_coverage`）

### 3. Req-Analyst 类任务（`03-req-analyst`）

关注：

- 六维度字段完整性（`field_completeness`）
- 规范引用准确性（`spec_accuracy`）
- 场景适配性（`scenario_adaptation`）
- 关键点覆盖率（`keypoint_coverage`）

## 评估维度总览

| 维度                  | 适用对象          | 说明                          |
| --------------------- | ----------------- | ----------------------------- |
| `retrieval_hit`       | RAG               | 是否命中预期来源              |
| `citation_ok`         | RAG               | 引用来源是否正确              |
| `keypoint_coverage`   | RAG / Agent / Req | 关键点片段命中率 ≥ 50%        |
| `task_completed`      | 全部              | 是否完成了任务本身            |
| `tool_path_ok`        | Agent             | 所有预期工具是否都被调用      |
| `constraint_ok`       | Agent             | 是否遵守系统边界（只读/安全） |
| `field_completeness`  | Req-Analyst       | 六维度是否都有实质内容        |
| `spec_accuracy`       | Req-Analyst       | API/组件/事件格式是否合法     |
| `scenario_adaptation` | Req-Analyst       | 是否适配具体场景而非套用模板  |

## 失败分类

| 类型                | 含义                         |
| ------------------- | ---------------------------- |
| `retrieval_miss`    | 没找到正确知识               |
| `citation_wrong`    | 找到了但引用错了             |
| `keypoint_miss`     | 关键点覆盖率不足（< 50%）    |
| `tool_choice_wrong` | 用错工具或顺序明显不合理     |
| `task_incomplete`   | 回答不完整，任务未完成       |
| `constraint_break`  | 触发了不该触发的边界问题     |
| `field_incomplete`  | Req-Analyst 六维度字段不完整 |
| `spec_inaccurate`   | Req-Analyst 规范引用不准确   |
| `scenario_mismatch` | Req-Analyst 场景适配不足     |

## 文件清单

- `task-set-template.json` — 任务集模板（含字段说明）
- `rag-eval-round-01.json` — RAG 首轮评估任务集（8 个任务）
- `agent-eval-round-01.json` — Agent 首轮评估任务集（5 个任务）
- `req-analyst-eval-round-01.json` — Req-Analyst 首轮评估任务集（5 个任务）

## 使用原则

- 先少量、高质量任务，不要一开始就追求数量
- 先规则检查（deterministic），再考虑 LLM 裁判
- 每次 Prompt / 检索 / Agent 调整后，都应该能回到这里做回归
- 评估报告输出到 `projects/05-agent-eval/reports/`
