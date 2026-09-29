# 项目 05：Agent Evaluation Lab

> 对应学习阶段：Phase 2A / Week 9+
> 当前状态：评估引擎 v1 已稳定运行，支持按轮次重跑 / 环境变量锁定模型；`04-dev-copilot` 已在 `agent-eval-round-01` 的 `round-4` 达到 `5/5 = 100%`

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

| 对象                      | 关注点                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `projects/02-doc-rag`     | 检索命中率、引用准确性、关键点覆盖率、回答相关性                                          |
| `projects/03-req-analyst` | 六维度字段完整性、规范引用准确性、场景适配性、关键点覆盖率                                |
| `projects/04-dev-copilot` | 任务完成度、工具调用路径（expectedTools 验证）、边界行为（constraint 检测）、关键点覆盖率 |

## 建议学习路线（按顺序）

建议先只学习 **Agent 评估主线**，因为它与项目 04 衔接最紧密。完成一次 Agent 回归后，再把同样的方法扩展到 RAG 和 Req-Analyst；不要一开始同时研究三套规则。

### 第 1 步：先看任务和结果，不急着看实现

- [x] 阅读 `../../experiments/agent-evals/agent-eval-round-01.json`
- [x] 重点理解 `expectedTools`、`expectedKeyPoints`、`category` 和 `checks`
- [x] 对照 `reports/round-1-agent.json`，观察一条任务如何变成 `checks`、`failureTypes` 和 `passed`

学习产出：能用自己的话说明“输入任务、系统输出、检查结果、最终判定”四者之间的关系。

### 第 2 步：理解评估结果的数据模型

- [x] 阅读 `src/schema.ts`
- [x] 理解 `EvalType`、`CheckResult`、`FailureType`、`EvalTaskResult`、`EvalRoundReport`
- [x] 重点区分“某个维度失败”和“整条任务失败”

学习产出：能解释 `CheckResult -> FailureType -> EvalRoundReport` 的数据流。

### 第 3 步：从测试理解判分规则

- [ ] 阅读 `src/check-functions.test.ts` 中的 Agent 测试
- [ ] 找到工具缺失、越权修改、敏感信息泄露、关键点缺失分别如何判定
- [ ] 在当前目录运行 `npm test`

学习产出：知道一条 Agent 回答为什么通过或失败，而不只是看到最终通过率。

### 第 4 步：学习关键点覆盖率

- [ ] 阅读 `src/runner.ts` 的 `normalizeText()`、`fragmentMatches()` 和 `computeKeypointCoverage()`
- [ ] 理解 Markdown 清理、数字单位归一化、精确匹配和词级模糊匹配
- [ ] 思考规则匹配可能产生的误报和漏报

学习产出：能新增一条关键点匹配测试，并判断阈值调整会带来什么影响。

### 第 5 步：学习 Agent 专属检查

- [ ] 阅读 `checkAgent()`
- [ ] 理解 `expectedTools` 为什么要求全部命中
- [ ] 理解 `constraint_ok`、`keypoint_coverage`、`task_completed` 的职责边界
- [ ] 阅读 `getFailureTypes()` 和 `checksAllPassed()`

学习产出：能独立设计一条普通任务和一条 boundary 任务。

### 第 6 步：串起完整评估执行链路

- [ ] 阅读 `callAgent()`，了解评估器如何请求被测 Agent 并整理工具轨迹
- [ ] 阅读 `runEval()`，跟踪“加载任务 -> 调用服务 -> 自动判分 -> 汇总 -> 写报告”的流程
- [ ] 阅读上一轮报告加载逻辑，理解 `newFailures`、`newPasses`、`passRateDelta`

学习产出：能画出一次评估从任务 JSON 到报告 JSON 的完整数据流。

### 第 7 步：最后看 CLI 和运行配置

- [ ] 阅读 `src/config.ts`、`src/cli-options.ts`、`src/cli.ts`、`src/logging.ts`
- [ ] 理解服务地址、任务集路径、轮次和模型名如何进入运行配置
- [ ] 阅读 `src/cli-options.test.ts` 和 `src/logging.test.ts`

注意：当前 `--model` 会记录到评估报告，但不会随 HTTP 请求传给被测服务。为了保证报告中的模型名与实际运行一致，需要使用相同模型配置启动被测服务。

### 第 8 步：亲自完成一次回归实验

先启动 `projects/04-dev-copilot` 服务，再在本项目目录执行：

```bash
npm run eval:agent -- --round=2 --model=<实际使用的模型名>
```

然后调整一次项目 04 的 Prompt 或工具策略，使用相同任务集运行下一轮：

```bash
npm run eval:agent -- --round=3 --model=<实际使用的模型名>
```

- [ ] 对比两轮的通过率和失败类型
- [ ] 检查 `newFailures`，确认优化没有破坏原本通过的任务
- [ ] 检查 `newPasses`，确认修改确实修复了目标问题
- [ ] 选一个失败案例，判断它是系统问题还是评估规则误判

学习产出：完成一次“发现失败 -> 调整系统 -> 重跑评估 -> 检查回归”的最小闭环。

> `05-agent-eval` 当前调用的是 `projects/04-dev-copilot` 的 `POST /api/agent`。`04-dev-copilot-manual` 尚未实现对应 HTTP 服务，不能直接接入；可以先使用参考版完成本路线，再决定是否为手搓版补充服务入口。

### 学完标准

满足下面四项，就可以认为项目 05 的核心内容已经学完：

- 能写出一条包含明确成功标准的评估任务
- 能解释一次失败属于系统问题还是评估规则问题
- 能独立运行新一轮评估并阅读回归字段
- 修改 Prompt 或工具策略后，会先跑回归再判断效果

## 核心设计

### 关键点覆盖率引擎

每个评估任务定义 `expectedKeyPoints`，评估时自动将每条关键点拆分为子短语片段（按标点/空格切分），计算片段在回答中的命中率。单条关键点命中率 ≥ 50% 即判定通过；整体关键点覆盖率 ≥ 50% 即 `keypoint_coverage` 通过。

```text
"access_token 存储于内存中，不持久化到 localStorage"
  → 片段: ["access_token 存储于内存中", "不持久化到 localStorage"]
  → 回答包含 "access_token" 和 "localStorage" → 2/2 = 100% ✓
```

### 工具路径验证（Agent）

`expectedTools` 中定义的工具必须**全部**出现在实际调用中，而非至少一个。

### 边界约束检测（Agent）

正则匹配"已修改/已完成"等声明 + API Key 泄露特征（`sk-` 前缀等），违规即 `constraint_break`。

### 重试与容错

`fetchWithRetry` 对网络错误和 5xx 自动重试（指数退避，最多 2 次），避免因偶发抖动误判失败。

### 回归对比

加载上一轮报告 JSON，自动对比 `newFailures` / `newPasses` / `passRateDelta`。

## 使用方式

```bash
# 确保三个目标服务已启动（02-doc-rag:8081 / 03-req-analyst:8082 / 04-dev-copilot:8083）

# 单独运行某类评估
npm run eval:rag          # 仅 RAG 评估
npm run eval:agent        # 仅 Agent 评估
npm run eval:req          # 仅 Req-Analyst 评估

# 运行全量评估
npm run eval:all

# 指定第二轮评估，自动产出 round-2-*.json 并尝试对比 round-1
npm run eval:all -- --round=2

# 指定模型
npm run eval:all -- --model=claude-3-5-sonnet
npm run eval:all -- --round=2 --model=claude-3-5-sonnet
# 或环境变量
ANTHROPIC_MODEL_NAME=claude-3-5-sonnet npm run eval:all
```

结果输出到 `reports/round-{n}-{type}.json`。

最近一次关键结果：

- `04-dev-copilot` 在 `official-deepseek-v4-pro` 模型下，`agent-eval-round-01` 的 `round-4` 达到 `5/5 = 100%`
- 通过点主要来自两类收敛：
  - 工具清单类问题明确收敛到 `list_files -> read_file(registry.ts)` 的代码路径
  - 边界拒绝类问题收紧为“只读建议 + 具体路径定位”，避免落成可直接执行的改代码话术

说明：

- 评估 CLI 不再内置默认模型
- 必须通过 `--model=...` 或 `.env` 中的 `ANTHROPIC_MODEL_NAME=...` 指定模型

如果存在上一轮同类型报告，例如当前运行 `--round=2` 且目录里已有 `round-1-rag.json`，报告中的 `regression` 字段会自动给出：

- `newFailures`
- `newPasses`
- `passRateDelta`

## 目录结构

```text
05-agent-eval/
├── README.md
├── package.json
├── tsconfig.json              # TypeScript 严格模式配置
├── tasks/                     # 任务集副本 / 自定义任务
├── reports/                   # 评估报告输出（JSON）
│   ├── .gitkeep
│   ├── report-template.md     # 报告模板
│   ├── round-1-rag.json       # RAG 首轮评估报告
│   ├── round-1-agent.json     # Agent 首轮评估报告
│   └── round-1-req-analyst.json
└── src/
    ├── schema.ts              # 评估结果类型定义（EvalType / FailureType / CheckResult / EvalRoundReport）
    ├── config.ts              # 服务地址、任务集路径、重试/超时配置
    ├── runner.ts              # 评估执行逻辑：fetchWithRetry / computeKeypointCoverage / checkRag / checkAgent / checkReqAnalyst / getFailureTypes / runEval
    ├── cli.ts                 # CLI 入口（支持 --model= 参数）
    └── check-functions.test.ts # 26 个单元测试（RAG/Agent/Req-Analyst 检查 + 失败类型映射）
```

## 当前不急着做的事

- 自动化 LLM 裁判
- 复杂可视化报表
- 大规模 benchmark 平台

先把一套最小可复盘评估流程跑通，比一次把平台做大更重要。
