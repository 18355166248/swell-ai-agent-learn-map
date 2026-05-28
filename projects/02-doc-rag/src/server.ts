import { config } from "dotenv";
import { resolve, dirname, join, basename } from "path";
import { fileURLToPath } from "url";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  renameSync,
  unlinkSync,
} from "fs";
import express from "express";
import multer from "multer";
import { chunkMarkdown } from "./chunker.js";
import { getEmbeddings } from "./embedder.js";
import { askWithRag } from "./rag.js";
import type { VectorEntry } from "./retriever.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const app = express();
const PORT = Number(process.env.RAG_PORT) || 8081;

// 静态文件服务
app.use(express.static(resolve(__dirname, "..", "public")));
app.use(express.json());

// 文件上传配置
const KB_DIR = resolve(__dirname, "..", "docs", "knowledge-base");
const DATA_DIR = resolve(__dirname, "..", ".data");
const VECTORS_PATH = join(DATA_DIR, "vectors.json");

mkdirSync(KB_DIR, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  dest: KB_DIR,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (ext.endsWith(".md") || ext.endsWith(".txt")) {
      cb(null, true);
    } else {
      cb(new Error("仅支持 .md 和 .txt 文件"));
    }
  },
});

/** 递归收集目录下所有 .md / .txt 文件（扩展名大小写不敏感） */
function collectDocs(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDocs(fullPath));
    } else {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".md") || lower.endsWith(".txt")) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

/** 加载已索引的向量 */
function loadVectors(): VectorEntry[] {
  if (!existsSync(VECTORS_PATH)) {
    return [];
  }
  return JSON.parse(readFileSync(VECTORS_PATH, "utf-8"));
}

/** 执行文档索引。知识库为空时清空 vectors.json，防止残留旧数据。 */
async function runIndex(): Promise<number> {
  const docsDir = KB_DIR;
  const files = collectDocs(docsDir);

  if (files.length === 0) {
    writeFileSync(VECTORS_PATH, JSON.stringify([], null, 2), "utf-8");
    return 0;
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
  }

  if (allChunks.length === 0) {
    writeFileSync(VECTORS_PATH, JSON.stringify([], null, 2), "utf-8");
    return 0;
  }

  const texts = allChunks.map((c) => c.chunk);
  const embeddings = await getEmbeddings(texts);

  const vectors: VectorEntry[] = allChunks.map((chunk, i) => ({
    chunk: chunk.chunk,
    embedding: embeddings[i],
    source: chunk.source,
    index: chunk.index,
  }));

  writeFileSync(VECTORS_PATH, JSON.stringify(vectors, null, 2), "utf-8");
  return vectors.length;
}

// POST /api/ask — RAG 问答
app.post("/api/ask", async (req, res) => {
  try {
    const { question, rewrite = true, hybrid = false } = req.body;
    if (!question || typeof question !== "string") {
      res.status(400).json({ error: "请提供 question 字段" });
      return;
    }

    const vectors = loadVectors();
    if (vectors.length === 0) {
      res.status(400).json({ error: "索引为空，请先上传文档" });
      return;
    }

    const result = await askWithRag(question.trim(), vectors, {
      rewrite: !!rewrite,
      hybrid: !!hybrid,
    });
    res.json(result);
  } catch (err: any) {
    console.error("问答失败:", err.message);
    res.status(500).json({ error: `问答失败: ${err.message}` });
  }
});

// POST /api/index — 上传文档并重新索引
app.post("/api/index", upload.array("files", 20), async (req, res) => {
  try {
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;

    if (!uploadedFiles || uploadedFiles.length === 0) {
      // 没有上传新文件，仅重新索引
      const count = await runIndex();
      res.json({ message: "索引进度完成", count, files: collectDocs(KB_DIR).length });
      return;
    }

    // 将上传的文件重命名为原始文件名（只取 basename 防路径穿越）
    for (const file of uploadedFiles) {
      const safeName = basename(file.originalname);
      if (!safeName) continue;
      const newPath = join(KB_DIR, safeName);
      const resolvedPath = resolve(newPath);
      // 二次校验：确保最终路径未逃逸 KB_DIR
      if (!resolvedPath.startsWith(KB_DIR)) {
        throw new Error(`非法文件名: ${file.originalname}`);
      }
      if (existsSync(resolvedPath)) {
        unlinkSync(resolvedPath);
      }
      renameSync(file.path, resolvedPath);
    }

    // 重新索引
    const count = await runIndex();
    res.json({
      message: `已上传 ${uploadedFiles.length} 个文件并完成索引`,
      count,
      files: collectDocs(KB_DIR).length,
    });
  } catch (err: any) {
    console.error("索引失败:", err.message);
    res.status(500).json({ error: `索引失败: ${err.message}` });
  }
});

// multer 错误处理中间件（multer 在路由 handler 之前抛出，需要全局捕获）
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "上传文件数量超过限制（最多 20 个）" });
    } else if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "文件大小超过限制" });
    } else {
      res.status(400).json({ error: `文件上传错误: ${err.message}` });
    }
  } else if (err.message === "仅支持 .md 和 .txt 文件") {
    res.status(400).json({ error: err.message });
  } else {
    console.error("未捕获错误:", err.message || err);
    res.status(500).json({ error: "服务器内部错误" });
  }
});

// GET /api/status — 查看索引状态
app.get("/api/status", (_req, res) => {
  const vectors = loadVectors();
  const files = collectDocs(KB_DIR);
  res.json({
    files: files.map((f) =>
      f
        .replace(KB_DIR, "")
        .replace(/^[\\/]/, "")
        .replace(/\\/g, "/"),
    ),
    fileCount: files.length,
    vectorCount: vectors.length,
  });
});

app.listen(PORT, () => {
  console.log(`RAG 服务已启动: http://localhost:${PORT}`);
  console.log(`知识库目录: ${KB_DIR}`);
});
