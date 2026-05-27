import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, "..", "..", ".env");
const localEnv = resolve(__dirname, ".env.openai");

config({ path: rootEnv, override: false });
config({ path: localEnv, override: false });

import { analyzeContent, summarizeDirectory } from "./src/analyzer-openai.js";
import { parseCliOptions } from "./src/cli-options.js";
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_FREE_MODELS,
  resolveOpenAIModel,
} from "./src/openai-models.js";
import { runAnalysis } from "./src/run-analysis.js";
import { collectDirectoryFiles, readTargetFile } from "./src/target-loader.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`用法: npx tsx cli-openai.ts <文件路径> [选项]
  或: npx tsx cli-openai.ts --file <文件路径> [问题] [选项]
  或: npx tsx cli-openai.ts --dir <目录路径> [问题] [选项]

AI 代码解释器 (OpenAI SDK / OpenRouter 免费模型)

示例:
  npx tsx cli-openai.ts examples/sample.tsx
  npx tsx cli-openai.ts examples/sample.tsx "这个组件依赖了哪些接口？"
  npx tsx cli-openai.ts --file examples/sample.tsx "useUserInfo 来自哪里？"
  npx tsx cli-openai.ts --dir examples "这个目录做了什么？"
  npx tsx cli-openai.ts examples/sample.tsx --model qwen/qwen3-coder:free
  npx tsx cli-openai.ts examples/sample.tsx --stream

选项:
  --model, -m    指定模型（默认 ${resolveOpenAIModel(process.env.MODEL_NAME).modelName}）
  --stream, -s   在 stderr 实时打印模型输出
  --list-models  列出可用的免费模型

环境变量 (.env.openai):
  OPENAI_API_KEY    OpenRouter API Key
  OPENAI_BASE_URL   OpenRouter API 地址（可选，默认 https://openrouter.ai/api/v1）
  MODEL_NAME        默认模型

当前可用免费模型:
${OPENAI_FREE_MODELS.map((m) => `  - ${m}`).join("\n")}
`);
    process.exit(0);
  }

  if (args.includes("--list-models")) {
    console.log("OpenRouter 免费模型 (适合代码分析):\n");
    for (const m of OPENAI_FREE_MODELS) {
      console.log(`  ${m}`);
    }
    process.exit(0);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("错误: 未设置 OPENAI_API_KEY 环境变量");
    console.error(
      "请复制 projects/01-ai-code-explain/.env.openai.example 为 .env.openai 并填入 API Key",
    );
    process.exit(1);
  }

  // 解析 --model / -m 参数，覆盖环境变量中的模型名
  const modelIdx = args.findIndex((a) => a === "--model" || a === "-m");
  const requestedModel =
    modelIdx !== -1 && args[modelIdx + 1] ? args[modelIdx + 1] : process.env.MODEL_NAME;
  const resolvedModel = resolveOpenAIModel(requestedModel);
  process.env.MODEL_NAME = resolvedModel.modelName;
  if (resolvedModel.warning) {
    console.error(`[模型回退] ${resolvedModel.warning}\n`);
  }

  // 是否开启流式输出（--stream / -s）
  const shouldStream = args.includes("--stream") || args.includes("-s");

  // 从 args 中剔除 --stream/-s 和 --model/-m 及其值，剩余参数传给 parseCliOptions
  const analysisArgs = args.filter((arg, index) => {
    if (arg === "--stream" || arg === "-s") {
      return false;
    }

    if (arg === "--model" || arg === "-m") {
      return false;
    }

    if ((args[index - 1] === "--model" || args[index - 1] === "-m") && modelIdx !== -1) {
      return false;
    }

    return true;
  });

  console.error(`模型: ${process.env.MODEL_NAME || DEFAULT_OPENAI_MODEL}\n`);
  if (shouldStream) {
    console.error("Streaming: 已开启，增量输出将打印到 stderr\n");
  }

  try {
    const options = parseCliOptions(analysisArgs);
    const result = await runAnalysis(options, {
      readTargetFile,
      collectDirectoryFiles,
      analyzeContent: (filePath, fileContent, question) =>
        analyzeContent(filePath, fileContent, question, {
          onChunk: shouldStream
            ? (chunk) => {
                process.stderr.write(chunk);
              }
            : undefined,
        }),
      summarizeDirectory,
    });
    if (shouldStream) {
      process.stderr.write("\n\n");
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`分析失败: ${err.message}`);
    process.exit(1);
  }
}

main();
