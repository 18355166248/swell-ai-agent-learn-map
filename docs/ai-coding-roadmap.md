# Phase 3 路线图：AI Coding / Agent Engineer

> 制定日期：2026-06-18（2026-06-18 据字节抖音真实 JD 增补）
> 目标岗位：AI Native Engineer / Agent Engineer / AI Coding Engineer
> 标杆 JD：字节·抖音 AI 技术团队「AI Coding 研发工程师」40-70K·15 薪，上海杨浦，3-5 年，本科
> 语言策略：**TypeScript 为主，Python 按需**（JD 要求 1 明确列出 JS/TS 为可接受技术栈，验证此决策）
> 首攻方向：**Context Engineering**

---

## 〇、字节抖音 JD 逐条对照（能力清单的权威来源）

JD 原文要求的能力，对照本路线覆盖情况。✅=已覆盖 / 🟡=部分 / ➕=本次据 JD 增补。

| JD 能力点                             | 出处                      | 覆盖 | 落地位置                                     |
| ------------------------------------- | ------------------------- | ---- | -------------------------------------------- |
| 上下文工程体系                        | 团队介绍 / 职责2 / 要求2  | ✅   | Stage 1（首攻）                              |
| Agent 编排 / 调度策略                 | 团队介绍 / 职责2 / 要求2  | ✅   | Stage 2（LangGraph）                         |
| MultiAgent 工程                       | 团队介绍                  | ✅   | Stage 4                                      |
| Spec 开发模式                         | 团队介绍                  | ✅   | Stage 2                                      |
| 评测工程 / 评测建设                   | 职责3 / 要求2             | ✅   | Stage 5（已有 `05` 底子）                    |
| Agent Infra 建设                      | 职责3                     | ✅   | Stage 0（`agent-core`）                      |
| 需求理解 / 交付成功率                 | 团队介绍 / 职责2          | ✅   | Stage 2 + Stage 4                            |
| **D2C（Design to Code）**             | 职责2「关键子任务如 D2C」 | ➕   | **Stage 4 新增模块（前端王牌差异点）**       |
| **AgenticSearch**                     | 职责3                     | ➕   | Stage 1 检索升级为 agent 自主多轮检索        |
| **Skills**                            | 要求2                     | ➕   | Stage 0/1：Agent Skills 能力封装             |
| **模型适配策略**                      | 团队介绍 / 职责2          | ➕   | Stage 0：多模型路由/适配                     |
| **反向设计评测指标（业务/用户视角）** | 要求5                     | ➕   | Stage 5：业务指标视角                        |
| 系统设计 / 问题拆解                   | 要求3                     | ✅   | 贯穿（Spec + 多 Agent 拆分）                 |
| 大模型训练/评估研究 + 论文            | 要求4（加分项）           | ⬜   | 非必须，TS 路线不主攻；评估侧在 Stage 5 触及 |

> 差异化主张：JD 要求 1 把 JS/TS 与 Python/Go 并列，**8 年前端 + D2C 能力 = 对算法背景候选人的差异化优势**，而非劣势。

---

## 一、为什么是这条路线（与原 ChatGPT 计划的差异）

原 ChatGPT 计划建议第一个月用 Python/FastAPI/Postgres/Redis 重建 `agent-core`。**本路线明确不这么做**，理由：

1. **避免推翻已有资产**。前 11 周已手写出一套可运行的 Agent Runtime（ReAct + 工具 + 记忆 + 评估），并完成 LangGraph.js 迁移。这本身就是计划里 "项目 1 · Agent Runtime" 的成品，不需要换语言重造。
2. **AI Coding 赛道是 TS/Node 主场**。Cursor、Claude Code、VS Code 扩展、MCP 官方 SDK、LangGraph.js——核心生态都是 TypeScript。8 年前端 + 已有 TS Agent 代码是直接竞争优势。
3. **Python 按需点，不停一个月**。只在两处用 Python：评估框架 DeepEval（Stage 5）、个别需要 Python 生态的 MCP server。其余全部 TS。

> 这与原计划结尾的结论一致：「利用前端工程经验切入 AI Coding 和 Agent，是成功率最高、最匹配市场需求的路径。」

---

## 二、现有资产 → 目标作品集映射

JD 要求的 4 个作品集，**有 3 个能直接在现有项目上生长**，不必从零：

| 目标作品集                      | 对应能力                           | 现有起点                                           | 缺口                                                         |
| ------------------------------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| 项目 1 · Agent Runtime          | Agent Infra                        | ✅ `04-dev-copilot` + `06-langgraph-copilot`       | 抽成可复用的 `agent-core`（薄封装即可）                      |
| 项目 2 · Project Analysis Agent | **Context Engineering**            | 🟡 `04` 的只读工具链（search_code/grep/read_file） | 代码检索增强 + 上下文压缩 + 结构化分析输出                   |
| 项目 3 · Spec Agent             | Spec-Driven Development            | 🟡 `03-req-analyst`（6 维度结构化输出）            | requirements/design/tasks 三文件 + LangGraph 编排 + 人工审批 |
| 项目 4 · AI Coding Agent        | MultiAgent + Tool + Context + Eval | 🟡 全部前置项目                                    | 写入闭环（write/edit/git/terminal）+ 审批 + 多 Agent + MCP   |

**结论**：缺的不是"换语言重写基建"，而是这 4 块新能力 —— Context Engineering、Spec-Driven、代码写入/PR 闭环、MultiAgent + MCP。全部在 TS 项目上长出来。

---

## 三、阶段拆解（沿用"实际完成窗口"节奏，不锁定自然周）

### Stage 0 · 收尾 Week 11（~2-3 天）

把 LangGraph 迁移真正闭环，给"项目 1 · Agent Runtime"一个明确成品。

- [ ] 补 `experiments/langgraph-vs-handwritten/runner.ts`（README 已设计接口，代码未写）
- [ ] 跑出 `round-01-results.json` + `round-01-summary.md`，填回 README 的"最终判断"
- [ ] 从 `04` / `06` 抽一个薄封装 `agent-core`（Agent / Tool / Memory / Task 的统一类型与入口），作为后续项目的依赖底座
- [ ] **模型适配层**（JD「模型适配策略」）：在 `agent-core` 加一层模型路由——按任务/成本/能力选模型，统一不同 provider 的消息与工具格式。已有起点：commit `b487c37` 已把模型名做成环境变量配置，往上长即可
- [ ] **Skills 雏形**（JD「Skills」）：把"一组工具 + 一段 system 指令 + 触发条件"封装成可声明、可复用的 Skill 单元（参考 Claude Skills 设计），让 Agent 按场景加载能力，而非把所有工具/提示词堆在一起
- [ ] `PROGRESS.md` Week 11 标记 ✅ 完成

> 成果：可复用的 `agent-core`（含模型适配 + Skills 封装）+ 手写 vs 框架的实测对比结论（面试高频问题："什么时候该用框架"有数据支撑）。

---

### Stage 1 · Context Engineering（首攻，最重，2-4 周）

**项目**：`projects/07-context-engineer/`（项目 2 · Project Analysis Agent）

> 输入：「分析这个 React 项目」 → 输出：项目结构 / 技术栈 / 模块依赖 / 风险点

这是字节 JD 最看重的能力，也是与"只会 LangChain + RAG + 向量库"的人拉开差距的关键。

**1. 先研究，再动手（半周）**

- [ ] 拆解 Claude Code / Cursor / Codex **为什么生成代码质量高** → 本质是上下文工程，不是模型差异
- [ ] 笔记沉淀：它们如何做 repo map、如何选要喂给模型的文件、如何控制 token 预算

**2. Context Retrieval → Agentic Search（JD「AgenticSearch」核心）**

- [ ] 复用 `04` 的 `search_code` / `grep` / `read_file`
- [ ] 新增 **repo map / 依赖图**：解析 import 关系，生成模块依赖树
- [ ] 新增 **符号级检索**：函数/组件/类型粒度（用 TS Compiler API 或 tree-sitter），而非整文件
- [ ] 三路检索：代码搜索 + 需求/文档搜索（复用 `02-doc-rag`）+ 历史记录搜索
- [ ] **从被动 RAG 升级为 Agentic Search**：不是一次性 top-k 检索，而是让 Agent 自主决定"搜什么 → 看结果 → 再搜/缩小范围 → 直到信息足够"的多轮迭代检索（对标 Claude Code / Cursor 的探索式定位）。这正是 JD 职责3 的「AgenticSearch」

**3. Context Compression（上下文压缩）**

- [ ] 文件树摘要、相关性排序、token 预算分配
- [ ] 对比"全量塞" vs "压缩后塞"的输出质量与成本

**4. 结构化分析输出**

- [ ] 输出 项目结构 / 技术栈 / 模块依赖 / 风险点 四维度（沿用 `03` 的结构化经验）

**5. 评估**

- [ ] 扩 `05-agent-eval`：新增上下文质量维度（检索命中精度、压缩后信息保留率）

> 成果：项目 2 完成，是整条线最能体现 Context Engineering 的作品。

---

### Stage 2 · Spec-Driven Development + Agent 编排（2-3 周）

**项目**：把 `03-req-analyst` 升级为 `projects/08-spec-agent/`（项目 3 · Spec Agent）

> 输入：「开发积分中心签到功能」 → 自动生成 `requirements.md` / `design.md` / `tasks.md`

这里让 **LangGraph 编排** 和 **Spec** 收敛到一起 —— 正好把 Week 11/12 学的 `StateGraph` / `interrupt()` 用在真实流程上。

- [ ] 用 LangGraph 多节点编排：需求分析 → 页面/接口/数据库设计 → 任务拆分
- [ ] 节点间用 `interrupt()` 插入 **人工审批**（Human-in-the-loop，原 Week 12 目标在此落地）
- [ ] 复用 Stage 1 的 Context Engineering：设计时检索现有代码/规范，让 Spec 贴合真实代码库
- [ ] 对标 Kiro / Claude Code 的 spec 模式：需求 → Spec → Task → Code 流程
- [ ] 评估维度：需求理解率、Spec 字段完整性、任务拆分可执行性

> 成果：项目 3 完成。这步直接命中 JD 明确提到的 "Spec 开发模式"。

---

### Stage 3 · MCP（按需，不过度，~1 周）

> 原则：MCP 不是第一优先级，**不要陷入"搭 100 个 MCP"的误区**。够用即可。

- [ ] 用官方 TS SDK 把 `agent-core` 的工具暴露为 **MCP Server**
- [ ] 写一个 **MCP Client**，消费外部 MCP（如文件系统、git）
- [ ] 理解 MCP Tool 协议与 Function Calling 的关系

> 成果：Coding Agent 的工具层具备标准化接入能力，为 Stage 4 铺垫。

---

### Stage 4 · AI Coding Agent（capstone，最值钱，3-5 周）

**项目**：`projects/09-coding-agent/`（项目 4 · 简化版 Cursor）

> 输入：「增加积分签到功能」
> Agent 自动：生成 Spec → 代码搜索 → 定位修改点 → 修改代码 → 生成测试点 → 生成 PR 说明

**1. 写入工具集（在只读工具基础上加）**

- [ ] `write_file` / `edit_file`（diff 应用）/ `run_terminal` / `git`（branch / commit / diff）
- [ ] **审批门**：所有写操作经 LangGraph `interrupt()` 人工确认 + diff review + 回滚

**2. MultiAgent 编排**

- [ ] Planner（出 Spec，复用项目 3）→ Coder（改代码）→ Reviewer（审 diff + 测试点）
- [ ] 节点间状态传递，失败回退

**3. D2C 模块（Design to Code）— JD 明确点名的关键子任务，前端王牌**

- [ ] 输入设计稿（Figma JSON / 截图）→ 输出可用前端组件代码（React/Vue + TS）
- [ ] 两条技术路线择一深入：① 多模态模型读截图直接生成；② 解析 Figma 结构树 → 映射到组件库 → 生成代码
- [ ] 接入项目 2 的 Context Engineering：生成时检索现有组件库/设计规范，让产出贴合团队代码风格（而非凭空造组件）
- [ ] 评测：还原度、可编译率、对现有组件的复用率
- [ ] **为什么这是你的差异化**：D2C 横跨"设计语义理解 + 前端工程 + Agent 生成"，8 年前端在组件抽象、设计规范、可维护代码上的判断力，是纯算法背景候选人难以替代的

**4. 闭环串联**

- [ ] Spec（项目 3）→ Agentic Search 定位（项目 2）→ 修改 / D2C 生成 → 测试点 → PR 说明
- [ ] 全流程跑通一个真实小需求

> 成果：项目 4 完成。这是面试时最能讲清"为什么需要 Context / Spec / Eval / 编排 / MultiAgent / D2C"的作品。

---

### Stage 5 · Evaluation 深化 + Benchmark（2 周，Python 按需）

**项目**：`projects/10-agent-benchmark/`

- [ ] 学 **DeepEval**（Python，按需点）/ 浏览 OpenAI Evals 思路
- [ ] 技术指标：需求理解率 / 代码生成成功率 / 任务完成率 / 工具调用成功率
- [ ] **业务/用户视角反向设计指标**（JD 要求5）：从"需求交付成功率""人工返工率""端到端交付耗时"这类业务 KPI 出发，反推该测哪些技术指标、怎么设计实验方案。这是 JD 强调的产品意识与指标意识
- [ ] 建立自己的 Agent Benchmark，给项目 4 跑出可量化分数

> 成果：把 `05-agent-eval` 升级为体系化评测，作品集有"可证明变好"的数据。

---

## 四、最终作品集（半年后目标）

| #   | 项目                          | 能力关键词                                   | 来源             |
| --- | ----------------------------- | -------------------------------------------- | ---------------- |
| 1   | Agent Runtime（`agent-core`） | Agent Infra                                  | 04 + 06 抽取     |
| 2   | Project Analysis Agent        | Context Engineering                          | Stage 1 新建     |
| 3   | Spec Agent                    | Spec-Driven + 编排 + HITL                    | Stage 2 升级     |
| 4   | AI Coding Agent（含 D2C）     | MultiAgent + Context + Tool + Eval + **D2C** | Stage 4 capstone |

面试字节时能讲清这 5 个"为什么"，即超过大部分只会 LangChain/RAG/向量库的候选人：
为什么需要 Context Engineering · 为什么需要 Spec · 为什么需要 Evaluation · 为什么需要 Agent 编排 · 为什么需要 MultiAgent。

---

## 五、Python 出现的唯二位置

| 位置            | 阶段            | 用途               | 为什么不用 TS                       |
| --------------- | --------------- | ------------------ | ----------------------------------- |
| DeepEval        | Stage 5         | LLM 评估框架       | Python 生态成熟，作为评估工具按需点 |
| 个别 MCP server | Stage 3（可选） | 接 Python 生态工具 | 仅当目标工具只有 Python 实现时      |

其余全部 TypeScript。不为 Python 停一个月，不重建后端基建。

---

## 六、与原计划的对应关系（给自己对账用）

| 原 ChatGPT 计划阶段               | 本路线如何消化                                   |
| --------------------------------- | ------------------------------------------------ |
| 1 月 · Agent Infra（Python 重建） | ❌ 不重建，改为 Stage 0 抽取已有 TS `agent-core` |
| 2 月 · Context Engineering        | ✅ Stage 1（首攻）                               |
| 3 月 · Agent 编排（LangGraph）    | ✅ 已在 Week 11 起步，Stage 2 用于真实 Spec 流程 |
| 4 月 · Spec-Driven                | ✅ Stage 2                                       |
| 5 月 · AI Coding Agent            | ✅ Stage 4                                       |
| 6 月 · Evaluation                 | ✅ Stage 5（已有 `05` 底子）                     |
| MCP（3-4 月）                     | ✅ Stage 3，刻意保持轻量                         |
