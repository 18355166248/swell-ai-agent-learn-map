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

    console.log(
      `[ReqAnalyst] requirement="${requirement.trim().slice(0, 80)}" | model=${process.env.MODEL_NAME || "(未配置)"}`,
    );

    try {
      const result = await analyzeRequirement(requirement.trim());
      res.json({ requirement, ...result });
    } catch (analyzeErr: any) {
      // LLM / 检索失败时返回兜底分析，避免 500
      console.error("分析失败，返回兜底结果:", analyzeErr.message);
      const desc = requirement.trim().slice(0, 80);
      res.json({
        requirement: requirement.trim(),
        pageChanges: [{ page: "相关页面", changes: `根据需求"${desc}"推导的页面改动` }],
        apiDependencies: [{ endpoint: "/api/related", usage: "需求涉及的接口", isNew: true }],
        trackingRequirements: [
          {
            eventType: "element_click",
            moduleId: "auto_inferred",
            description: "需求涉及的交互埋点",
          },
        ],
        componentDependencies: [{ component: "RelatedComponent", usage: "需求涉及的组件" }],
        risks: [
          {
            risk: `LLM 分析失败（${analyzeErr.message.slice(0, 60)}），以下为通用兜底分析`,
            level: "high",
            mitigation: "请重新尝试或补充规范文档后再次分析",
          },
        ],
        testSuggestions: [
          { scenario: "验证基本功能流程", priority: "high" },
          { scenario: "验证异常情况", priority: "medium" },
        ],
      });
    }
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
  console.log(`生成模型: ${process.env.MODEL_NAME || "(未配置)"}`);
});
