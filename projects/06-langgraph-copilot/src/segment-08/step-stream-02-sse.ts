/**
 * 第 8 段 · 8-A：包装成 SSE 端点
 *
 * 把 LangGraph stream 包装成 Express SSE 端点。
 * 对比手写版 server.ts 的 onEvent 回调模式：
 *   LangGraph 的 async iterator 和手写的 callback 是两种不同的消费方式，各有适用场景。
 *
 * 运行：npx tsx src/segment-08/step-stream-02-sse.ts
 * 然后访问：http://localhost:8084/api/agent/stream?task=你好
 */

import "dotenv/config";
import express from "express";
import { StateGraph, START, END, MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const modelName = process.env.MODEL_NAME || "gpt-4o";

// 简化的单轮对话图
const llm = new ChatOpenAI({ model: modelName, streaming: true });
const graph = new StateGraph(MessagesAnnotation)
  .addNode("askLLM", async (state) => {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  })
  .addEdge(START, "askLLM")
  .addEdge("askLLM", END)
  .compile();

const app = express();
const PORT = Number(process.env.COPILOT_PORT) || 8084;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/agent/stream", async (req, res) => {
  const task = (req.query.task as string)?.trim();
  if (!task) {
    res.status(400).json({ error: "请提供 task 参数" });
    return;
  }

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
    // messages mode：token 级流式
    for await (const [msg, metadata] of await graph.stream(
      { messages: [new HumanMessage(task)] },
      { streamMode: "messages" },
    )) {
      if ("content" in msg && (msg as any).content) {
        sendSSE("token", {
          content: (msg as any).content,
          node: (metadata as any)?.langgraph_node,
        });
      }
    }
    sendSSE("done", { status: "complete" });
  } catch (err: any) {
    sendSSE("error", { message: err.message });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`SSE 演示服务已启动: http://localhost:${PORT}`);
  console.log(`测试命令: curl "http://localhost:${PORT}/api/agent/stream?task=你好"`);
});
