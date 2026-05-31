import type { EvalType } from "./schema.js";

const VALID_TYPES: EvalType[] = ["rag", "agent", "req-analyst"];

export interface CliOptions {
  type: EvalType | "all";
  round: number;
  model: string;
  config: {
    model: string;
    temperature: number;
    maxTokens: number;
  };
}

function parseRound(rawRound: string | undefined): number {
  if (!rawRound) {
    return 1;
  }

  const round = Number.parseInt(rawRound, 10);
  if (!Number.isInteger(round) || round < 1) {
    throw new Error("--round 必须是大于等于 1 的整数");
  }

  return round;
}

function resolveModelName(explicitModel: string | undefined, env: NodeJS.ProcessEnv): string {
  const model = explicitModel ?? env.MODEL_NAME;
  if (!model) {
    throw new Error("缺少模型配置，请通过 --model 传入，或在 .env 中设置 MODEL_NAME");
  }
  return model;
}

export function parseCliOptions(argv: string[], env: NodeJS.ProcessEnv = process.env): CliOptions {
  const typeArg = argv.find((arg) => !arg.startsWith("--"));
  const type = (typeArg ?? "all").toLowerCase();
  const rawRound = argv.find((arg) => arg.startsWith("--round="))?.split("=")[1];
  const round = parseRound(rawRound);
  const explicitModel = argv.find((arg) => arg.startsWith("--model="))?.split("=")[1];
  const model = resolveModelName(explicitModel, env);

  if (type !== "all" && !VALID_TYPES.includes(type as EvalType)) {
    throw new Error(`无效类型: ${type}`);
  }

  return {
    type: type as EvalType | "all",
    round,
    model,
    config: {
      model,
      temperature: 0.3,
      maxTokens: 2048,
    },
  };
}
