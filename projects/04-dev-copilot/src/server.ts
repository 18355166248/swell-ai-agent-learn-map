import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import express from "express";
import { runAgent } from "./agent/index.js";
import type { AgentStreamEvent } from "./agent/index.js";
import { listConversations, deleteConversation } from "./agent/memory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", ".env"), override: false });

const app = express();
const PORT = Number(process.env.COPILOT_PORT) || 8083;

app.use(express.static(resolve(__dirname, "..", "public")));
app.use(express.json({ limit: "50kb" }));

// 同步模式
app.post("/api/agent", async (req, res) => {
  try {
    const { task, conversationId } = req.body as { task?: string; conversationId?: string };
    if (!task || typeof task !== "string") {
      res.status(400).json({ error: "请提供 task 字段" });
      return;
    }

    console.log(
      `[DevCopilot] task="${task.trim().slice(0, 80)}" | conv=${conversationId || "(新会话)"} | model=${process.env.MODEL_NAME || "(未配置)"}`,
    );

    // 兜底超时：6 分钟内必须完成
    const AGENT_TIMEOUT = 360_000;
    const result = await Promise.race([
      runAgent(task.trim(), { silent: true, timeout: AGENT_TIMEOUT, conversationId }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Agent 超时（${AGENT_TIMEOUT / 1000}s）`)),
          AGENT_TIMEOUT,
        ),
      ),
    ]);
    res.json(result);
  } catch (err: any) {
    console.error("Agent 失败:", err.message);
    res.status(500).json({ error: `分析失败: ${err.message}` });
  }
});

// SSE 流式模式
app.get("/api/agent/stream", async (req, res) => {
  const task = (req.query.task as string)?.trim();
  const conversationId = (req.query.conversationId as string) || undefined;
  if (!task) {
    res.status(400).json({ error: "请提供 task 参数" });
    return;
  }

  console.log(
    `[DevCopilot/stream] task="${task.slice(0, 80)}" | conv=${conversationId || "(新会话)"} | model=${process.env.MODEL_NAME || "(未配置)"}`,
  );

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const sendSSE = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    let stepIndex = 0;
    const onEvent = (event: AgentStreamEvent) => {
      switch (event.type) {
        case "tool_call":
          sendSSE("step", {
            id: ++stepIndex,
            iteration: event.iteration,
            type: "tool_call",
            toolName: event.toolName,
            toolArgs: event.toolArgs || {},
            content: event.content,
          });
          break;
        case "tool_result":
          sendSSE("result", {
            id: stepIndex,
            toolName: event.toolName || "",
            content: event.content,
          });
          break;
        case "answer":
          sendSSE("answer", {
            id: ++stepIndex,
            type: "answer",
            content: event.content,
          });
          break;
        case "error":
          sendSSE("error", { message: event.content });
          break;
      }
    };

    const result = await runAgent(task, { silent: false, onEvent, conversationId });
    sendSSE("done", {
      answer: result.answer,
      iterations: result.iterations,
      conversationId: result.conversationId,
    });
  } catch (err: any) {
    sendSSE("error", { message: err.message });
  } finally {
    res.end();
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// 列出所有会话
app.get("/api/conversations", (_req, res) => {
  try {
    const convos = listConversations();
    res.json(convos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除会话
app.delete("/api/conversations/:id", (req, res) => {
  try {
    const ok = deleteConversation(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "会话不存在" });
      return;
    }
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Dev Copilot 服务已启动: http://localhost:${PORT}`);
  console.log(`生成模型: ${process.env.MODEL_NAME || "(未配置)"}`);
});
