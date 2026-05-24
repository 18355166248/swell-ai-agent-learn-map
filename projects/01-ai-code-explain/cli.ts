import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 先尝试加载项目根目录的 .env，再尝试当前目录
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, "..", "..", "..", ".env");
const localEnv = resolve(__dirname, ".env");

config({ path: rootEnv, override: false });
config({ path: localEnv, override: false });

import { analyzeFile } from "./src/analyzer.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`用法: npx tsx cli.ts <文件路径>

AI 代码解释器 — 分析前端代码文件，输出结构化 JSON 分析结果。

示例:
  npx tsx cli.ts examples/sample.tsx
  npx tsx cli.ts ./src/pages/home/index.tsx

环境变量:
  ANTHROPIC_API_KEY  Anthropic API 密钥（或 OPENAI_API_KEY）
  OPENAI_BASE_URL    可选。自定义 API 地址
  MODEL_NAME         可选。模型名称
`);
    process.exit(0);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("错误: 未设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY 环境变量");
    console.error("请在项目目录创建 .env 文件并设置 ANTHROPIC_API_KEY=...");
    process.exit(1);
  }

  const filePath = args[0];

  try {
    const result = await analyzeFile(filePath);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`分析失败: ${err.message}`);
    process.exit(1);
  }
}

main();
