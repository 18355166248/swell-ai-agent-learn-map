# 下一阶段方向总纲

> 这份文档的目的不是列功能清单，而是先把方向定准：接下来学什么、为什么先学它、哪些方向现在还不适合直接做。

## 1. 先重申这个仓库的目标

这个仓库的目标不是持续做出更多 AI 工具，而是记录一条清晰的 AI Native / AI Agent 学习成长路径。

所以后面的每一步都应该服务这 3 件事：

1. 继续补齐 AI Native 系统能力
2. 让每一阶段都能产出可验证的结果
3. 把“我为什么这样学、为什么这样做”沉淀成可复盘的方法

如果某个方向只是“看起来更酷”，但不能帮助你建立系统能力或成长记录，就不应该优先做。

## 2. 你现在已经走到哪一步

前 8 周已经完成的能力可以概括成：

- 基础调用：Prompt、LLM API、Streaming、错误处理
- 知识层：Embedding、Chunk、RAG、引用来源、检索优化
- 场景层：真实研发文档接入、结构化需求分析
- 编排层：Tool Calling、ReAct、只读 Agent、多步分析

这意味着你已经完成了：

- 从“调模型”到“做系统”
- 从“单次回答”到“知识检索”
- 从“知道什么”到“先查什么”

但你还没有完成的是：

- 怎么评估系统是否变好
- 怎么让系统记住用户和任务
- 怎么让系统在真实工作流里可控执行
- 怎么让系统具备长期可演进性

## 3. 方向池总评估

下面是你提到的所有方向，我按“现在是否适合学”重新整理了一次。

| 方向                            | 现在适合度 | 为什么                                                       |
| ------------------------------- | ---------- | ------------------------------------------------------------ |
| Evaluation                      | `高`       | 这是后面所有能力的前置条件，没有它就无法判断系统是否变好     |
| Retrieval quality 评估          | `高`       | 你已经有 RAG，马上可以评估，收益直接                         |
| Answer quality 评估             | `高`       | 现在就能做，而且能补齐“看起来能用”和“真的好用”的差别         |
| Agent task completion 评估      | `高`       | 你已经有 `dev-copilot`，正适合补任务完成评估                 |
| Regression 记录                 | `高`       | 这是把评估结果转成长期工程机制的关键                         |
| Tool trace / retrieval hit 分析 | `高`       | 已有基础，补起来成本低，能直接增强可观察性                   |
| 失败原因分类                    | `高`       | 评估体系的组成部分，适合现在一起做                           |
| Prompt / version 管理           | `中高`     | 很值得做，但最好建立在评估体系之后                           |
| 用户任务完成率统计              | `中`       | 值得做，但更适合系统开始长期使用后补                         |
| Session memory                  | `中高`     | 很重要，但如果先没评估，容易做成“记忆很多但不知道有没有帮助” |
| Task state persistence          | `中高`     | 和 session memory 一样，建议放在评估之后                     |
| Workspace context               | `中`       | 有价值，但要先定义清楚记忆边界和上下文粒度                   |
| User profile                    | `中低`     | 更偏产品层，适合系统开始面向稳定用户后再补                   |
| 审批式写操作                    | `中`       | 值得学，但前提是评估和边界先稳定                             |
| 人工确认点                      | `中高`     | 可以较早进入，因为它是 Human-in-the-loop 的基础              |
| diff review                     | `中高`     | 非常适合未来写操作 Agent，但要晚于评估体系                   |
| 可回滚 workflow                 | `中`       | 只有进入写操作后才真正有价值                                 |
| 任务拆分 + 人工接管             | `中高`     | 很适合下一阶段，但最好在 memory 和任务状态之后做             |
| AI Native workflow integration  | `中高`     | 是正确方向，但不应该现在直接跳过去做大而全版本               |

## 4. 建议顺序

### 第一优先级：Evaluation

这是你现在最应该学的。

原因很简单：

- 你已经有了 RAG 和 Agent 原型
- 现在最缺的不是新能力，而是判断能力
- 如果没有评估，后面做 Memory、写操作、工作流集成都会变得很虚

这一阶段应该重点回答：

- 怎么设计任务集
- 怎么做 answer quality 评估
- 怎么评估 retrieval quality
- 怎么评估 agent task completion
- 怎么记录 regression
- 怎么做 failure taxonomy
- 怎么做 tool trace / retrieval hit 分析

### 第二优先级：Memory

这一阶段建议放在 Evaluation 后。

因为只有先知道当前系统在什么任务上表现好或不好，才知道记忆应该服务什么目标。

这一阶段可以重点学：

- session memory
- task state persistence
- workspace context
- long-term memory

建议先不碰太重的 `user profile`，先把“任务连续性”做好。

### 第三优先级：Human-in-the-loop

这是把 Agent 真正从“分析系统”推进到“协作系统”的关键一步。

这一阶段重点不是“让它自动写更多东西”，而是“让它在可控前提下参与更多工作”。

建议重点学：

- 审批式写操作
- 人工确认点
- diff review
- 可回滚 workflow
- 任务拆分 + 人工接管

这里的关键判断是：

自动化不是目标，可控协作才是目标。

### 第四优先级：AI Native workflow

这应该是前 3 个阶段之后的结果，而不是现在直接跳进去做的东西。

到这一阶段时，你再去接真实研发流程会更稳：

- 需求分析
- 方案草拟
- 文档生成
- 测试点整理
- code review 辅助

如果现在直接做这些，很容易变成“看起来覆盖了工作流，实际上底层能力和边界都还没打稳”。

## 5. 每个方向具体该学什么

### 5.1 Evaluation

建议拆成 5 个子主题：

1. 任务集设计
   - 问答类任务
   - 分析类任务
   - 代码观察类任务
   - 边界类任务

2. 评分维度
   - retrieval hit
   - citation accuracy
   - answer quality
   - task completion
   - constraint compliance

3. 失败分类
   - retrieval miss
   - citation wrong
   - tool choice wrong
   - task incomplete
   - constraint break

4. 回归机制
   - 改 Prompt 后回归
   - 改检索策略后回归
   - 改工具逻辑后回归

5. 可观察性
   - tool trace
   - retrieval hit 分析
   - prompt/version 管理

### 5.2 Memory

建议拆成 4 个子主题：

1. 会话记忆
   - 记住上一轮结论
   - 支持任务继续

2. 任务状态
   - 当前任务做到哪一步
   - 哪些子任务已经完成

3. 工作区上下文
   - 当前项目是什么
   - 当前文档集是什么
   - 当前使用的约束是什么

4. 长期记忆
   - 保留用户偏好
   - 保留常见任务模式

### 5.3 Human-in-the-loop

建议拆成 4 个子主题：

1. 审批点设计
   - 什么时候必须确认
   - 什么操作可以直接执行

2. 变更展示
   - diff review
   - 风险提示

3. 回滚机制
   - 怎么撤销
   - 怎么恢复到上一步

4. 人工接管
   - Agent 卡住时怎么把任务交回给人
   - 人继续之后怎么再交还给 Agent

### 5.4 Workflow Integration

建议拆成 5 个真实研发子流程：

1. 需求分析
2. 方案草拟
3. 文档生成
4. 测试点整理
5. code review 辅助

不要一口气做五个，建议一次只做一个。

## 6. 现在最适合你的具体顺序

如果按你当前基础来排，我建议是：

1. `Evaluation`
2. `Memory`
3. `Human-in-the-loop`
4. `Workflow Integration`

更细一点可以拆成：

1. 先做 RAG + Agent 评估集
2. 再做 regression 和 trace
3. 再做 session memory + task state
4. 再做审批式写操作和人工确认点
5. 最后再接一个真实研发流程

## 7. 当前不建议优先做的东西

下面这些方向不是没价值，而是现在先做容易跑偏：

- 多 Agent 编排
- 复杂 Planner / Executor / Critic 架构
- 一上来就做全自动写代码
- 一上来就做通用长期用户画像系统
- 一上来就做“覆盖整个研发生命周期”的大而全平台

这些方向都有价值，但都应该建立在前面 4 个优先级已经清楚之后。

## 8. 未来 2-3 个阶段的建议产物

### Phase 2A：Evaluation

建议产物：

- `projects/05-agent-eval/`
- `experiments/agent-evals/`
- 一套任务集模板
- 一套失败分类和回归机制

### Phase 2B：Memory

建议产物：

- 带会话状态的 Agent 原型
- 任务恢复能力
- workspace context 结构设计

### Phase 2C：Human-in-the-loop

建议产物：

- 受控写操作实验
- diff review / approval flow
- rollback 机制原型

### Phase 2D：Workflow

建议产物：

- 一个真实研发场景的 AI Native 工作流
- 一条从输入任务到产出结果的可演示链路

## 9. 最终建议

如果只用一句话概括：

你现在最不该做的是继续追求“更复杂的 Agent 形态”，最该做的是把 **评估、记忆、协作、工作流** 这四层按顺序补起来。

其中，**Evaluation 是第一优先级，而且必须先做。**

没有 Evaluation，后面的所有增强都很难判断方向到底对不对。
