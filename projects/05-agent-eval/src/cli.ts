import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { runEval, checkAllServices } from "./runner.js";
import { TASK_SETS } from "./config.js";
import type { EvalType } from "./schema.js";
import { parseCliOptions } from "./cli-options.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
loadEnv({ path: resolve(__dirname, "..", ".env"), override: false });

const VALID_TYPES: EvalType[] = ["rag", "agent", "req-analyst"];

async function main() {
  let options;
  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`参数错误: ${message}`);
    console.error(
      `用法: npx tsx src/cli.ts [rag|agent|req-analyst|all] [--round=<n>] [--model=<name>]`,
    );
    console.error(`  --round=<n>     指定评估轮次，默认 1`);
    console.error(`  --model=<name>  覆盖默认模型（也可通过环境变量 MODEL_NAME 设置）`);
    process.exit(1);
  }

  const { type, round, config } = options;

  if (type === "all") {
    console.log("🚀 启动全量评估（RAG + Agent + Req-Analyst）\n");
    console.log(`🤖 当前模型: ${config.model}\n`);
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
    console.log(`🤖 当前模型: ${config.model}\n`);
    await checkAllServices();
    try {
      await runEval(TASK_SETS[t], t, `round-${round}-${t}`, round, config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ ${t} 评估失败: ${message}`);
      process.exit(1);
    }
  } else {
    console.error(
      `用法: npx tsx src/cli.ts [rag|agent|req-analyst|all] [--round=<n>] [--model=<name>]`,
    );
    console.error(`  --round=<n>     指定评估轮次，默认 1`);
    console.error(`  --model=<name>  覆盖默认模型（也可通过环境变量 MODEL_NAME 设置）`);
    console.error(`无效类型: ${type}`);
    process.exit(1);
  }
}

main();
