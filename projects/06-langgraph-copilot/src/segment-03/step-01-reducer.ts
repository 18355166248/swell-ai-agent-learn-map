/**
 * 第 3 段 · 步骤 3-1：用假消息理解 reducer
 *
 * 这段只学：MessagesAnnotation 的 messages 字段为什么是"追加"而不是"覆盖"
 *
 * 运行：npx tsx src/segment-03/step-01-reducer.ts
 */

import { StateGraph, START, END, MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const graph = new StateGraph(MessagesAnnotation)
  .addNode("addMessage", (state) => {
    console.log(`当前消息数: ${state.messages.length}`);
    return {
      messages: [new AIMessage(`这是第 ${state.messages.length + 1} 条消息`)],
    };
  })
  .addEdge(START, "addMessage")
  .addEdge("addMessage", END)
  .compile();

// 第一次 invoke：2 条初始消息 → 节点追加 1 条 → 共 3 条
let result = await graph.invoke({
  messages: [new HumanMessage("Hello"), new HumanMessage("World")],
});
console.log(`invoke 后: ${result.messages.length} 条消息`); // 3

// 第二次 invoke：传入上一次的全部消息 → 节点再追加 1 条 → 共 4 条
result = await graph.invoke({ messages: result.messages });
console.log(`第二次 invoke 后: ${result.messages.length} 条消息`); // 4

// 🧪 小实验：把 MessagesAnnotation 换成 Annotation.Root({ messages: Annotation<AIMessage[]> })
// （去掉 reducer）。同样的代码，messages 会被覆盖而不是追加。
