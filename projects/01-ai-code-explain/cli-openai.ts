import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, "..", "..", "..", ".env");
const localEnv = resolve(__dirname, ".env.openai");

config({ path: rootEnv, override: false });
config({ path: localEnv, override: false });

import { analyzeFile } from "./src/analyzer-openai.js";

const FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-coder:free",
  "deepseek/deepseek-v4-flash:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`用法: npx tsx cli-openai.ts <文件路径> [选项]

AI 代码解释器 (OpenAI SDK / OpenRouter 免费模型)

示例:
  npx tsx cli-openai.ts examples/sample.tsx
  npx tsx cli-openai.ts examples/sample.tsx --model qwen/qwen3-coder:free

选项:
  --model, -m    指定模型（默认 ${process.env.MODEL_NAME || "openai/gpt-oss-120b:free"}）
  --list-models  列出可用的免费模型

环境变量 (.env.openai):
  OPENAI_API_KEY    OpenRouter API Key
  OPENAI_BASE_URL   OpenRouter API 地址
  MODEL_NAME        默认模型

当前可用免费模型:
${FREE_MODELS.map((m) => `  - ${m}`).join("\n")}
`);
    process.exit(0);
  }

  if (args.includes("--list-models")) {
    console.log("OpenRouter 免费模型 (适合代码分析):\n");
    for (const m of FREE_MODELS) {
      console.log(`  ${m}`);
    }
    process.exit(0);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("错误: 未设置 OPENAI_API_KEY 环境变量");
    console.error("请复制 .env.openai.example 为 .env.openai 并填入 API Key");
    process.exit(1);
  }

  // 解析 --model 参数
  const modelIdx = args.findIndex((a) => a === "--model" || a === "-m");
  if (modelIdx !== -1 && args[modelIdx + 1]) {
    process.env.MODEL_NAME = args[modelIdx + 1];
  }

  const filePath = args[0];

  console.error(`模型: ${process.env.MODEL_NAME || "openai/gpt-oss-120b:free"}\n`);

  try {
    const result = await analyzeFile(filePath);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`分析失败: ${err.message}`);
    process.exit(1);
  }
}

main();
