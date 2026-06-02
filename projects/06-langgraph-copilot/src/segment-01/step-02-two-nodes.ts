/**
 * 第 1 段 · 步骤 1-2：两个节点，数据流经两个函数
 *
 * 这段只学：节点函数只返回自己要改的字段（partial state），LangGraph 自动合并
 *
 * 运行：npx tsx src/segment-01/step-02-two-nodes.ts
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  name: Annotation<string>,
  greeting: Annotation<string>,
});

const graph = new StateGraph(State)
  .addNode("setName", (state) => ({ name: "Alice" }))
  .addNode("greet", (state) => ({ greeting: `Hello, ${state.name}!` }))
  .addEdge(START, "setName")
  .addEdge("setName", "greet")
  .addEdge("greet", END)
  .compile();

const result = await graph.invoke({ name: "", greeting: "" });
console.log(result);
// { name: "Alice", greeting: "Hello, Alice!" }

// 🧪 小实验：交换两个节点的顺序
const graphSwapped = new StateGraph(State)
  .addNode("setName", (state) => ({ name: "Alice" }))
  .addNode("greet", (state) => ({ greeting: `Hello, ${state.name}!` }))
  .addEdge(START, "greet") // greet 先执行——但此时 name 还是空的
  .addEdge("greet", "setName")
  .addEdge("setName", END)
  .compile();

const resultSwapped = await graphSwapped.invoke({ name: "", greeting: "" });
console.log("交换顺序后:", resultSwapped);
// greeting 变成 "Hello, !" —— 因为 greet 执行时 name 还没被设置
