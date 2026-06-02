import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// 先尝试加载项目根目录的 .env，再尝试当前目录
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, "..", "..", ".env");
const localEnv = resolve(__dirname, ".env");

config({ path: rootEnv, override: false });
config({ path: localEnv, override: false });

// 导入各模块：分析器、CLI 参数解析、分析流程编排、文件加载
import { analyzeContent, summarizeDirectory } from "./src/analyzer.js";
import { parseCliOptions } from "./src/cli-options.js";
import { runAnalysis } from "./src/run-analysis.js";
import { collectDirectoryFiles, readTargetFile } from "./src/target-loader.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`用法: npx tsx cli.ts <文件路径>
  或: npx tsx cli.ts --file <文件路径> [问题]
  或: npx tsx cli.ts --dir <目录路径> [问题]

AI 代码解释器 — 分析前端代码文件，输出结构化 JSON 分析结果。

示例:
  npx tsx cli.ts examples/sample.tsx
  npx tsx cli.ts examples/sample.tsx "这个组件依赖了哪些接口？"
  npx tsx cli.ts --file examples/sample.tsx "useUserInfo 来自哪里？"
  npx tsx cli.ts --dir examples "这个目录做了什么？"

环境变量:
  ANTHROPIC_API_KEY  Anthropic API 密钥（或 OPENAI_API_KEY）
  ANTHROPIC_BASE_URL 可选。Anthropic 兼容网关地址
  ANTHROPIC_MODEL_NAME         可选。模型名称
`);
    process.exit(0);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("错误: 未设置 ANTHROPIC_API_KEY 或 OPENAI_API_KEY 环境变量");
    console.error("请在项目目录创建 .env 文件并设置 ANTHROPIC_API_KEY=...");
    process.exit(1);
  }

  try {
    const options = parseCliOptions(args);
    const result = await runAnalysis(options, {
      readTargetFile,
      collectDirectoryFiles,
      analyzeContent,
      summarizeDirectory,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`分析失败: ${err.message}`);
    process.exit(1);
  }
}

main();
