# 评估报告 · {name}

**日期**：{date}　**轮次**：Round {round}　**评估人**：{evaluator}

## 系统配置

| 参数        | 值                |
| ----------- | ----------------- |
| 模型        | {model}           |
| Temperature | {temperature}     |
| Max Tokens  | {max_tokens}      |
| 检索 Top-K  | {retrieval_top_k} |
| 混合检索    | {hybrid_enabled}  |

## 结果总览

| 指标     | 值           |
| -------- | ------------ |
| 总任务数 | {total}      |
| 通过数   | {passed}     |
| 通过率   | {pass_rate}% |

### 按维度

| 维度                | 通过/总数                 | 通过率                          |
| ------------------- | ------------------------- | ------------------------------- |
| retrieval_hit       | {dim_retrieval_hit}       | {dim_retrieval_hit_rate}%       |
| citation_ok         | {dim_citation_ok}         | {dim_citation_ok_rate}%         |
| keypoint_coverage   | {dim_keypoint_coverage}   | {dim_keypoint_coverage_rate}%   |
| task_completed      | {dim_task_completed}      | {dim_task_completed_rate}%      |
| tool_path_ok        | {dim_tool_path_ok}        | {dim_tool_path_ok_rate}%        |
| constraint_ok       | {dim_constraint_ok}       | {dim_constraint_ok_rate}%       |
| field_completeness  | {dim_field_completeness}  | {dim_field_completeness_rate}%  |
| spec_accuracy       | {dim_spec_accuracy}       | {dim_spec_accuracy_rate}%       |
| scenario_adaptation | {dim_scenario_adaptation} | {dim_scenario_adaptation_rate}% |

### 按难度

| 难度   | 通过/总数 | 通过率         |
| ------ | --------- | -------------- |
| simple | {simple}  | {simple_rate}% |
| medium | {medium}  | {medium_rate}% |
| hard   | {hard}    | {hard_rate}%   |

### 失败分布

| 失败类型                          | 数量                   |
| --------------------------------- | ---------------------- |
| retrieval_miss（检索未命中）      | {ft_retrieval_miss}    |
| citation_wrong（引用错误）        | {ft_citation_wrong}    |
| keypoint_miss（关键点覆盖率不足） | {ft_keypoint_miss}     |
| tool_choice_wrong（工具选择错误） | {ft_tool_choice_wrong} |
| task_incomplete（任务不完整）     | {ft_task_incomplete}   |
| constraint_break（边界突破）      | {ft_constraint_break}  |
| field_incomplete（字段不完整）    | {ft_field_incomplete}  |
| spec_inaccurate（规范引用不准确） | {ft_spec_inaccurate}   |
| scenario_mismatch（场景适配不足） | {ft_scenario_mismatch} |

## 逐任务详情

<!-- 以下为每条任务的评估详情，按 ID 排序 -->

### {task_id}　{passed_icon}　{task_question}

- **类型**：{type}　**目标项目**：{target_project}　**难度**：{difficulty}
- **检查结果**：
  - {check_items}
- **失败分类**：{failure_types}
- **实际输出摘要**：
  ```
  {actual_answer_excerpt}
  ```
- **来源 / 工具轨迹**：
  ```
  {sources_or_tool_steps}
  ```
- **关键点匹配**：
  ```
  {keypoint_match_summary}
  ```
- **备注**：{notes}

---

<!-- 重复以上 block 直到所有任务列出 -->

## 回归对比

<!-- 仅当存在上一轮报告时填写 -->

| 指标   | 上一轮 ({prev_round}) | 本轮         | 变化    |
| ------ | --------------------- | ------------ | ------- |
| 通过率 | {prev_rate}%          | {curr_rate}% | {delta} |

**新增失败**：

- {new_failure_items}

**新增通过**：

- {new_pass_items}

## 本轮结论

<!-- 回答三个问题：1. 当前系统在哪类任务上表现好？2. 最突出的问题是什么？3. 下一步应该优先改进什么？ -->

{conclusion}

## 下一步建议

{next_steps}
