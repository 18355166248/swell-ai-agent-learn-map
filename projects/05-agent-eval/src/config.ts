// 评估运行配置

/** 三个目标服务的默认地址 */
export const SERVICES = {
  rag: "http://localhost:8081",
  "req-analyst": "http://localhost:8082",
  agent: "http://localhost:8083",
} as const;

/** 任务集文件路径（相对于 src/ 目录，需上溯 3 级到仓库根） */
export const TASK_SETS = {
  rag: "../../../experiments/agent-evals/rag-eval-round-01.json",
  agent: "../../../experiments/agent-evals/agent-eval-round-01.json",
  "req-analyst": "../../../experiments/agent-evals/req-analyst-eval-round-01.json",
} as const;

/** 结果输出目录 */
export const OUTPUT_DIR = "../reports";

/** 默认评估配置 */
export const DEFAULT_CONFIG = {
  /** 请求超时（毫秒） */
  timeout: 120_000,
  /** 并发任务数（暂串行，后续可改） */
  concurrency: 1,
};
