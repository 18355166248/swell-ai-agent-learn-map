/**
 * LangGraph 版 Agent 服务 —— SSE 流式 + MemorySaver 持久化
 *
 * 对比手写版 server.ts（153 行）：
 *   - onEvent callback → async iterator（stream）
 *   - 手动 history 注入 → MemorySaver 自动 checkpoint 恢复
 *
 * 启动：npx tsx src/server.ts
 */

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", ".env"), override: true });
config({ path: resolve(__dirname, "..", ".env"), override: true });

import express from "express";
import { getGraph, makeThreadId, DEFAULT_RECURSION_LIMIT, buildMessages } from "./agent.js";
import { JsonFileSaver } from "./json-file-saver.js";

const app = express();
const PORT = Number(process.env.COPILOT_PORT) || 8084;

app.use(express.json({ limit: "50kb" }));

// ============================================================
// 启动时一次性初始化：checkpointer + 编译图
// ============================================================
const checkpointer = new JsonFileSaver(resolve(__dirname, ".checkpoints", "server-state.json"));
const graph = getGraph(checkpointer);

// ============================================================
// 非流式端点
// ============================================================
app.post("/api/agent", async (req, res) => {
  try {
    const { task, threadId } = req.body as { task?: string; threadId?: string };
    if (!task || typeof task !== "string") {
      res.status(400).json({ error: "请提供 task 字段" });
      return;
    }

    console.log(
      `[LangGraph] task="${task.trim().slice(0, 80)}" | thread=${threadId || "(新会话)"}`,
    );

    const effectiveThreadId = threadId || makeThreadId();

    const config: any = {
      recursionLimit: DEFAULT_RECURSION_LIMIT,
      configurable: { thread_id: effectiveThreadId },
    };

    const messages = await buildMessages(task.trim(), graph, effectiveThreadId);

    const result = await graph.invoke({ messages }, config);

    const lastMsg = result.messages[result.messages.length - 1];
    res.json({
      answer: (lastMsg as any).content || "",
      messageCount: result.messages.length,
      threadId: effectiveThreadId,
    });
  } catch (err: any) {
    console.error("Agent 失败:", err.message);
    res.status(500).json({ error: `分析失败: ${err.message}` });
  }
});

// ============================================================
// SSE 流式端点
// ============================================================
app.get("/api/agent/stream", async (req, res) => {
  const task = (req.query.task as string)?.trim();
  const threadId = (req.query.threadId as string) || undefined;
  if (!task) {
    res.status(400).json({ error: "请提供 task 参数" });
    return;
  }

  console.log(`[LangGraph/stream] task="${task.slice(0, 80)}" | thread=${threadId || "(新会话)"}`);

  const effectiveThreadId = threadId || makeThreadId();

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
    const config: any = {
      recursionLimit: DEFAULT_RECURSION_LIMIT,
      configurable: { thread_id: effectiveThreadId },
    };

    // updates 模式：每次 yield 当前步骤的变更
    for await (const chunk of await graph.stream(
      { messages: await buildMessages(task, graph, effectiveThreadId) },
      { ...config, streamMode: "updates" },
    )) {
      const nodeName = Object.keys(chunk)[0];
      const nodeOutput = (chunk as any)[nodeName];

      if (nodeName === "agent" && nodeOutput.messages) {
        const msg = nodeOutput.messages[0];
        if (msg.tool_calls?.length) {
          sendSSE("step", {
            type: "tool_call",
            node: nodeName,
            toolCalls: msg.tool_calls.map((tc: any) => ({
              name: tc.name,
              args: tc.args,
            })),
          });
        } else if (msg.content) {
          sendSSE("answer", {
            type: "answer",
            content: msg.content,
          });
        }
      } else if (nodeName === "tools" && nodeOutput.messages) {
        for (const toolMsg of nodeOutput.messages) {
          sendSSE("result", {
            type: "tool_result",
            content:
              typeof toolMsg.content === "string" ? toolMsg.content.slice(0, 300) : "[非文本结果]",
          });
        }
      }
    }

    sendSSE("done", { status: "complete", threadId: effectiveThreadId });
  } catch (err: any) {
    sendSSE("error", { message: err.message });
  } finally {
    res.end();
  }
});

// ============================================================
// 健康检查
// ============================================================
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", engine: "LangGraph" });
});

// ============================================================
// 启动
// ============================================================
app.listen(PORT, () => {
  console.log(`LangGraph Copilot 服务已启动: http://localhost:${PORT}`);
  console.log(`模型: ${process.env.MODEL_NAME || "claude-sonnet-4-6"}`);
  console.log(`端点:`);
  console.log(`  POST /api/agent          — 非流式`);
  console.log(`  GET  /api/agent/stream    — SSE 流式`);
  console.log(`  GET  /api/health          — 健康检查`);
});
