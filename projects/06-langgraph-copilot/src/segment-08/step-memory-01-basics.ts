/**
 * 第 8 段 · 8-B：MemorySaver 保存的是什么
 *
 * MemorySaver 是一个 checkpointer：它为每个 thread_id 保存 graph state
 *
 * 关键认知（与手写版对比）：
 *
 * | 维度          | 手写 MemoryStore（memory.ts）                   | LangGraph MemorySaver                           |
 * | ------------- | ----------------------------------------------- | ----------------------------------------------- |
 * | 存什么        | 每轮 Q&A 摘要 + steps 摘要                      | 完整的 graph state（含所有 messages, tool_calls） |
 * | 持久化        | 文件 JSON（重启不丢）                           | 内存（重启丢失）                                |
 * | 标识          | conversationId 参数                             | configurable.thread_id                          |
 * | 注入方式      | 手动调 formatHistoryContext 构造 system message | 框架自动从 checkpoint 恢复 state                |
 * | system prompt | 每次自己拼                                      | 取决于实现                                      |
 *
 * 运行：npx tsx src/segment-08/step-memory-01-basics.ts
 */

import "dotenv/config";
import { StateGraph, START, END, MessagesAnnotation, MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const modelName = process.env.MODEL_NAME || "gpt-4o";
const llm = new ChatOpenAI({ model: modelName });

// 构建图（不 compile，返回 builder 供调用方按需 compile）
function buildGraph() {
  return new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const response = await llm.invoke(state.messages);
      return { messages: [response] };
    })
    .addEdge(START, "agent")
    .addEdge("agent", END);
}

// 不带 checkpointer 的图
{
  console.log("=== 不带 MemorySaver ===");
  const graph = buildGraph().compile();

  const result1 = await graph.invoke({
    messages: [
      new SystemMessage("你是一个有帮助的助手。请用中文回答。"),
      new HumanMessage("我叫 Alice"),
    ],
  });
  console.log(
    "第1轮:",
    (result1.messages[result1.messages.length - 1] as any).content.slice(0, 60),
  );

  // 第二次 invoke：没有传之前的 messages，LLM 不知道上下文
  const result2 = await graph.invoke({
    messages: [new HumanMessage("我刚才说我叫什么？")],
  });
  console.log(
    "第2轮（不带历史）:",
    (result2.messages[result2.messages.length - 1] as any).content.slice(0, 60),
  );
}

// 带 MemorySaver 的图
{
  console.log("\n=== 带 MemorySaver ===");
  const checkpointer = new MemorySaver();
  const graph = buildGraph().compile({ checkpointer });

  const config = { configurable: { thread_id: "conv-001" } };

  // 第一次 invoke：graph state 被 checkpoint
  await graph.invoke(
    {
      messages: [
        new SystemMessage("你是一个有帮助的助手。请用中文回答。"),
        new HumanMessage("我叫 Alice"),
      ],
    },
    config,
  );

  // 第二次 invoke：graph 从上次的 checkpoint 恢复 state
  // 所以 messages 自动包含第一轮的全部历史
  const result2 = await graph.invoke(
    {
      messages: [new HumanMessage("我刚才说我叫什么？")],
    },
    config,
  );
  const answer = result2.messages[result2.messages.length - 1];
  console.log("第2轮:", (answer as any).content.slice(0, 100));

  // 查看 checkpoint 中的状态
  const state = await graph.getState(config);
  console.log(`checkpoint 中消息数: ${(state.values as any).messages.length}`);
}

// 🧪 小实验：同 thread_id 连续 invoke 两次，打印 state.messages.length。
// 对比手写 MemoryStore 的 formatHistoryContext：
// 前者存了所有中间消息，后者只存了最终 Q&A 摘要。
