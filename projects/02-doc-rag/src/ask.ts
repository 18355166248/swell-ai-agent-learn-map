import { config } from "dotenv";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import OpenAI from "openai";
import { getEmbedding } from "./embedder.js";
import { retrieve, type VectorEntry } from "./retriever.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

function resolveModelName(): string {
  const model = process.env.MODEL_NAME;
  if (!model) {
    throw new Error("未设置 MODEL_NAME 环境变量");
  }
  return model;
}
const TOP_K = 3;

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    baseURL: process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Doc RAG",
    },
  } as any);
}

function loadVectors(): VectorEntry[] {
  const vectorsPath = resolve(__dirname, "..", ".data", "vectors.json");
  if (!existsSync(vectorsPath)) {
    throw new Error(`向量文件不存在: ${vectorsPath}\n请先运行 npx tsx src/index.ts <docs目录>`);
  }
  return JSON.parse(readFileSync(vectorsPath, "utf-8"));
}

function buildPrompt(question: string, chunks: string[]): string {
  const context = chunks.map((c, i) => `[文档片段 ${i + 1}]:\n${c}`).join("\n\n---\n\n");

  return `你是一个知识库问答助手。请根据以下文档内容回答用户的问题。

如果文档内容无法回答该问题，请明确说明"根据现有文档无法回答此问题"，不要编造答案。

文档内容：
${context}

用户问题：${question}

请用简洁、准确的中文回答。`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("用法: npx tsx src/ask.ts <问题>");
    console.error('示例: npx tsx src/ask.ts "图片上传 CDN 的流程是什么？"');
    process.exit(1);
  }

  const question = args.join(" ");
  console.log(`问题: ${question}\n`);

  // 加载向量库
  const vectors = loadVectors();
  console.log(`已加载 ${vectors.length} 条向量记录`);

  // 问题向量化
  const queryEmbedding = await getEmbedding(question);
  // 检索 Top-K
  const results = retrieve(queryEmbedding, vectors, TOP_K);
  console.log("检索结果:");
  for (const r of results) {
    console.log(
      `  [${r.similarity.toFixed(4)}] ${r.entry.source}#${r.entry.index}: ${r.entry.chunk.slice(0, 80)}...`,
    );
  }

  // 构建 Prompt
  const chunks = results.map((r) => r.entry.chunk);
  const prompt = buildPrompt(question, chunks);

  // 调用 LLM 流式输出。
  const client = getClient();
  const modelName = resolveModelName();

  console.log(`\n回答 (${modelName}):`);
  console.log("─".repeat(60));

  const stream = await client.chat.completions.create({
    model: modelName,
    temperature: 0.3,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      process.stdout.write(delta);
    }
  }
  console.log("\n" + "─".repeat(60));
}

main().catch((err) => {
  console.error(`问答失败: ${err.message}`);
  process.exit(1);
});
