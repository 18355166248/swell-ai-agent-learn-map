/**
 * 第 2 段 · 步骤 2-1：编译一次，运行多次
 *
 * 这段只学：compile() 做了什么？invoke() 和普通函数调用有什么区别？
 *
 * 运行：npx tsx src/segment-02/step-01-compile-once.ts
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  text: Annotation<string>,
});

const graph = new StateGraph(State)
  .addNode("toUpper", (state) => ({ text: state.text.toUpperCase() }))
  .addEdge(START, "toUpper")
  .addEdge("toUpper", END)
  .compile(); // ← 编译后 graph 不再可变

// 同一个图，不同输入，各自独立运行
console.log(await graph.invoke({ text: "hello" })); // { text: "HELLO" }
console.log(await graph.invoke({ text: "world" })); // { text: "WORLD" }
console.log(await graph.invoke({ text: "graph" })); // { text: "GRAPH" }

// 🧪 小实验：compile 后尝试 addNode 会怎样？
// graph.addNode(...)  // ← 取消注释会报错：TypeError: graph.addNode is not a function
// 因为 compile() 返回的是 CompiledStateGraph，不再暴露 addNode 等 builder 方法
