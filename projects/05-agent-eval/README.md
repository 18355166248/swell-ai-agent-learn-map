# 项目 05：Agent Evaluation Lab

> 对应学习阶段：Phase 2A / Week 9+
> 当前状态：首轮评估已完成，评估引擎 v1 就绪，已支持按轮次重跑回归评估

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
MODEL_NAME=claude-3-5-sonnet npm run eval:all
```

结果输出到 `reports/round-{n}-{type}.json`。

说明：

- 评估 CLI 不再内置默认模型
- 必须通过 `--model=...` 或 `.env` 中的 `MODEL_NAME=...` 指定模型

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
