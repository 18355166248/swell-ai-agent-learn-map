import { config } from "dotenv";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { chunkMarkdown } from "../../02-doc-rag/src/chunker.js";
import { getEmbeddings } from "../../02-doc-rag/src/embedder.js";
import type { VectorEntry } from "../../02-doc-rag/src/retriever.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const KB_DIR = resolve(__dirname, "..", "docs", "knowledge-base");
const DATA_DIR = resolve(__dirname, "..", ".data");
const VECTORS_PATH = join(DATA_DIR, "vectors.json");

mkdirSync(DATA_DIR, { recursive: true });

function collectDocs(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDocs(fullPath));
    } else {
      if (/\.md$/i.test(entry.name)) files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const docsDir = KB_DIR;
  const files = collectDocs(docsDir);
  console.log(`知识库文档: ${files.length} 个`);

  if (files.length === 0) {
    writeFileSync(VECTORS_PATH, JSON.stringify([], null, 2), "utf-8");
    console.log("无文档，已清空索引");
    return;
  }

  const allChunks: { chunk: string; source: string; index: number }[] = [];
  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const relativePath = filePath
      .replace(docsDir, "")
      .replace(/^[\\/]/, "")
      .replace(/\\/g, "/");
    const chunks = chunkMarkdown(content, relativePath);
    allChunks.push(...chunks);
    console.log(`  ${relativePath}: ${chunks.length} chunks`);
  }

  if (allChunks.length === 0) {
    writeFileSync(VECTORS_PATH, JSON.stringify([], null, 2), "utf-8");
    return;
  }

  console.log(`生成 embeddings (${allChunks.length} 条)...`);
  const texts = allChunks.map((c) => c.chunk);
  const embeddings = await getEmbeddings(texts);

  const vectors: VectorEntry[] = allChunks.map((chunk, i) => ({
    chunk: chunk.chunk,
    embedding: embeddings[i],
    source: chunk.source,
    index: chunk.index,
  }));

  writeFileSync(VECTORS_PATH, JSON.stringify(vectors, null, 2), "utf-8");
  console.log(`索引完成: ${vectors.length} 条向量 → ${VECTORS_PATH}`);
}

main().catch((err) => {
  console.error("索引失败:", err.message);
  process.exit(1);
});
