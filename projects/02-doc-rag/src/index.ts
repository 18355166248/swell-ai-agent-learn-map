import { config } from "dotenv";
import { resolve, dirname, basename, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { chunkMarkdown } from "./chunker.js";
import { getEmbeddings } from "./embedder.js";
import type { VectorEntry } from "./retriever.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

/** 递归收集目录下所有 .md 文件 */
function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const docsDir = process.argv[2];

  if (!docsDir) {
    console.error("用法: npx tsx src/index.ts <docs目录路径>");
    console.error("示例: npx tsx src/index.ts docs/knowledge-base/");
    process.exit(1);
  }

  const absoluteDir = resolve(docsDir);
  console.log("absoluteDir", absoluteDir);
  const mdFiles = collectMarkdownFiles(absoluteDir);
  console.log(mdFiles);

  if (mdFiles.length === 0) {
    console.error(`目录 ${absoluteDir} 中没有找到 .md 文件`);
    process.exit(1);
  }

  console.log(`找到 ${mdFiles.length} 个 Markdown 文件\n`);

  // 切分所有文件
  const allChunks: { chunk: string; source: string; index: number }[] = [];
  for (const filePath of mdFiles) {
    const content = readFileSync(filePath, "utf-8");
    const relativePath = filePath.replace(absoluteDir, "").replace(/^\//, "");
    const chunks = chunkMarkdown(content, relativePath);
    console.log(`  ${relativePath}: ${chunks.length} 个 chunk`);
    allChunks.push(...chunks);
  }

  console.log(`\n总计 ${allChunks.length} 个 chunk，开始向量化...\n`);

  // 批量 embedding
  const texts = allChunks.map((c) => c.chunk);
  const embeddings = await getEmbeddings(texts);

  // 组装最终数据
  const vectors: VectorEntry[] = allChunks.map((chunk, i) => ({
    chunk: chunk.chunk,
    embedding: embeddings[i],
    source: chunk.source,
    index: chunk.index,
  }));

  // 持久化到 .data/
  const dataDir = resolve(__dirname, "..", ".data");
  mkdirSync(dataDir, { recursive: true });
  const outPath = join(dataDir, "vectors.json");
  writeFileSync(outPath, JSON.stringify(vectors, null, 2), "utf-8");

  console.log(`已保存 ${vectors.length} 条向量到 ${outPath}`);
}

main().catch((err) => {
  console.error(`索引失败: ${err.message}`);
  process.exit(1);
});
