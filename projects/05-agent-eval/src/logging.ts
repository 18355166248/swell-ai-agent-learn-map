export interface TaskSetHeaderInput {
  name: string;
  description: string;
  taskCount: number;
  round: number;
  model: string;
}

export function formatTaskSetHeader(input: TaskSetHeaderInput): string {
  return [
    `\n📋 加载任务集: ${input.name}`,
    `   描述: ${input.description}`,
    `   任务数: ${input.taskCount}`,
    `   轮次: ${input.round}`,
    `   模型: ${input.model}\n`,
  ].join("\n");
}

export function formatTaskResultLine(passed: boolean, detail: string): string {
  return passed ? `   ✅ 通过 | ${detail}` : `   ❌ 未通过 | ${detail}`;
}
