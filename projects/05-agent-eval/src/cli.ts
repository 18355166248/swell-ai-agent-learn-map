import { runEval, checkAllServices } from "./runner.js";
import { TASK_SETS } from "./config.js";
import type { EvalType } from "./schema.js";

const VALID_TYPES: EvalType[] = ["rag", "agent", "req-analyst"];

// 从命令行参数中提取位置参数（跳过 node/tsx/文件名）
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const type = (args[0] ?? "all").toLowerCase();

// 解析 --model 参数
const modelArg = process.argv.find((a) => a.startsWith("--model="));
const model = modelArg?.split("=")[1] ?? process.env.MODEL_NAME ?? "openai/gpt-oss-120b:free";

async function main() {
  const round = 1;
  const config = {
    model,
    temperature: 0.3,
    maxTokens: 2048,
  };

  if (type === "all") {
    console.log("🚀 启动全量评估（RAG + Agent + Req-Analyst）\n");
    await checkAllServices();

    for (const t of VALID_TYPES) {
      try {
        await runEval(TASK_SETS[t], t, `round-${round}-${t}`, round, config);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`\n❌ ${t} 评估失败: ${message}`);
      }
    }
    console.log("\n🏁 全量评估完成");
  } else if (VALID_TYPES.includes(type as EvalType)) {
    const t = type as EvalType;
    console.log(`🚀 启动 ${t} 评估\n`);
    await checkAllServices();
    try {
      await runEval(TASK_SETS[t], t, `round-${round}-${t}`, round, config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ ${t} 评估失败: ${message}`);
      process.exit(1);
    }
  } else {
    console.error(`用法: npx tsx src/cli.ts [rag|agent|req-analyst|all] [--model=<name>]`);
    console.error(`  --model=<name>  覆盖默认模型（也可通过环境变量 MODEL_NAME 设置）`);
    console.error(`无效类型: ${type}`);
    process.exit(1);
  }
}

main();
