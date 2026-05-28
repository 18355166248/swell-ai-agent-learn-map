import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import { analyzeRequirement } from "./analyst.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const app = express();
const PORT = Number(process.env.REQ_ANALYST_PORT) || 8082;

app.use(express.static(resolve(__dirname, "..", "public")));
app.use(express.json({ limit: "50kb" }));

app.post("/api/analyze", async (req, res) => {
  try {
    const { requirement } = req.body;
    if (!requirement || typeof requirement !== "string") {
      res.status(400).json({ error: "请提供 requirement 字段" });
      return;
    }

    const result = await analyzeRequirement(requirement.trim());
    res.json({ requirement, ...result });
  } catch (err: any) {
    console.error("分析失败:", err.message);
    res.status(500).json({ error: `分析失败: ${err.message}` });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`需求分析服务已启动: http://localhost:${PORT}`);
});
