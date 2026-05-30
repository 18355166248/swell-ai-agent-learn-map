// 评估结果类型定义 — 适用于 RAG / Agent / Req-Analyst 三类评估

// ---- 基础类型 ----

/** 评估任务类型 */
export type EvalType = "rag" | "agent" | "req-analyst";

/** 失败分类（与 experiments/agent-evals/README.md 对齐） */
export type FailureType =
  | "retrieval_miss" // 没找到正确知识
  | "citation_wrong" // 找到了但引用错了
  | "tool_choice_wrong" // 用错工具或顺序明显不合理
  | "task_incomplete" // 回答不完整，任务未完成
  | "constraint_break"; // 触发了不该触发的边界问题

/** 检查维度结果 */
export interface CheckResult {
  retrieval_hit?: boolean; // RAG: 是否命中预期来源
  citation_ok?: boolean; // RAG: 引用来源是否正确
  task_completed: boolean; // 通用: 是否完成了任务本身
  tool_path_ok?: boolean; // Agent: 工具调用路径是否合理
  constraint_ok?: boolean; // Agent: 是否遵守系统边界
  field_completeness?: boolean; // Req-Analyst: 六维度字段完整性
  spec_accuracy?: boolean; // Req-Analyst: 规范引用准确性
  scenario_adaptation?: boolean; // Req-Analyst: 场景适配性
}

// ---- 单任务结果 ----

/** 单条评估结果 */
export interface EvalTaskResult {
  /** 任务 ID，对应任务集 JSON 中的 id */
  taskId: string;
  /** 评估类型 */
  type: EvalType;
  /** 目标项目 */
  targetProject: string;
  /** 原始问题 */
  question: string;
  /** 各维度检查结果 */
  checks: CheckResult;
  /** 整体判定 */
  passed: boolean;
  /** 失败分类（passed=true 时为空） */
  failureTypes: FailureType[];
  /** 系统实际输出摘要 */
  actualOutput: {
    /** RAG/Req-Analyst: 答案文本（截断至 500 字符） */
    answer?: string;
    /** RAG/Agent: 引用来源或工具调用记录 */
    sources?: string[];
    /** Agent: 工具调用步骤记录 */
    toolSteps?: Array<{
      toolName: string;
      toolArgs: Record<string, unknown>;
      success: boolean;
      errorMessage?: string;
    }>;
    /** Agent: 总迭代次数 */
    iterations?: number;
  };
  /** 人工备注 */
  notes: string;
}

// ---- 轮次报告 ----

/** 一轮评估报告 */
export interface EvalRoundReport {
  meta: {
    /** 报告名称 */
    name: string;
    /** 评估日期 */
    date: string;
    /** 评估轮次 */
    round: number;
    /** 系统配置快照（模型名、参数等） */
    config: {
      model: string;
      temperature: number;
      maxTokens: number;
      retrievalTopK?: number;
      [key: string]: unknown;
    };
  };
  /** 任务结果列表 */
  results: EvalTaskResult[];
  /** 汇总统计 */
  summary: {
    /** 总任务数 */
    total: number;
    /** 通过数 */
    passed: number;
    /** 通过率 */
    passRate: number;
    /** 按维度统计 */
    byDimension: {
      retrieval_hit?: { total: number; passed: number; rate: number };
      citation_ok?: { total: number; passed: number; rate: number };
      task_completed: { total: number; passed: number; rate: number };
      tool_path_ok?: { total: number; passed: number; rate: number };
      constraint_ok?: { total: number; passed: number; rate: number };
      field_completeness?: { total: number; passed: number; rate: number };
      spec_accuracy?: { total: number; passed: number; rate: number };
      scenario_adaptation?: { total: number; passed: number; rate: number };
    };
    /** 按失败类型统计 */
    byFailureType: Record<FailureType, number>;
    /** 按难度统计 */
    byDifficulty: {
      simple: { total: number; passed: number; rate: number };
      medium: { total: number; passed: number; rate: number };
      hard: { total: number; passed: number; rate: number };
    };
  };
  /** 与上一轮的对比（回归检查） */
  regression?: {
    /** 上一轮报告名称 */
    previousRound: string;
    /** 新增失败的任务 ID */
    newFailures: string[];
    /** 修复的任务 ID */
    newPasses: string[];
    /** 通过率变化 */
    passRateDelta: number;
  };
}
