/**
 * 第 2 段 · 步骤 2-2：追踪 state 在 invoke 中的变化
 *
 * 这段只学：invoke 的完整生命周期——传入初始值 → 节点层层更新 → 返回最终 state
 *
 * 运行：npx tsx src/segment-02/step-02-trace-state.ts
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  a: Annotation<number>,
  b: Annotation<number>,
  c: Annotation<number>,
});

const graph = new StateGraph(State)
  .addNode("setA", (state) => {
    console.log("[setA] 进入时 state:", state);
    return { a: 10 };
  })
  .addNode("setB", (state) => {
    console.log("[setB] 进入时 state:", state);
    return { b: state.a * 2 }; // 读取上一个节点设置的 a
  })
  .addNode("setC", (state) => {
    console.log("[setC] 进入时 state:", state);
    return { c: state.a + state.b };
  })
  .addEdge(START, "setA")
  .addEdge("setA", "setB")
  .addEdge("setB", "setC")
  .addEdge("setC", END)
  .compile();

// 只传 a 的初始值，b 和 c 用 Annotation 的默认值（undefined）
const result = await graph.invoke({ a: 5 });
console.log("\n最终 state:", result);
// { a: 10, b: 20, c: 30 }

// 🧪 小实验：定义 3 个字段的状态，3 个节点各改其中一个字段。
// invoke 传入只包含一个字段的初始值。
// 观察：缺失字段使用 Annotation 的默认值、invoke 返回值是什么。
