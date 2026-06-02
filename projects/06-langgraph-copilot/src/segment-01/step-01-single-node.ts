/**
 * 第 1 段 · 步骤 1-1：一个节点、一条边的图
 *
 * 这段只学：Annotation.Root 声明状态 → StateGraph 建图 → addNode 注册节点 → addEdge 连线
 *
 * 运行：npx tsx src/segment-01/step-01-single-node.ts
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// ① 声明状态：图里流动的数据长什么样
const State = Annotation.Root({
  count: Annotation<number>,
});

// ② 建图：定义节点 + 连线
const graph = new StateGraph(State)
  .addNode("increment", (state) => ({ count: state.count + 1 }))
  .addEdge(START, "increment")
  .addEdge("increment", END)
  .compile();

// ③ 运行
const result = await graph.invoke({ count: 0 });
console.log(result); // { count: 1 }

// 🧪 小实验：把 +1 改成 *2。再加一个"减 1"的节点，用 addEdge 串起来。
const graph2 = new StateGraph(State)
  .addNode("double", (state) => ({ count: state.count * 2 }))
  .addNode("decrement", (state) => ({ count: state.count - 1 }))
  .addEdge(START, "double")
  .addEdge("double", "decrement")
  .addEdge("decrement", END)
  .compile();

const result2 = await graph2.invoke({ count: 5 });
console.log("5 * 2 - 1 =", result2.count); // 9
