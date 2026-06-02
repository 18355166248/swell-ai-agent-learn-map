/**
 * 第 1 段 · 步骤 1-3：自检练习
 *
 * 不用 LLM、不用工具，只用 StateGraph 实现：
 * "输入一个字符串，第一节点反转，第二节点转大写，第三节点加上长度信息"
 *
 * 运行：npx tsx src/segment-01/step-03-check-understanding.ts
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  text: Annotation<string>,
});

const graph = new StateGraph(State)
  .addNode("reverse", (state) => ({
    text: state.text.split("").reverse().join(""),
  }))
  .addNode("toUpper", (state) => ({
    text: state.text.toUpperCase(),
  }))
  .addNode("addLength", (state) => ({
    text: `${state.text} (长度: ${state.text.length})`,
  }))
  .addEdge(START, "reverse")
  .addEdge("reverse", "toUpper")
  .addEdge("toUpper", "addLength")
  .addEdge("addLength", END)
  .compile();

const result = await graph.invoke({ text: "hello" });
console.log(result.text); // "OLLEH (长度: 5)"

// 回答三个问题：
// 1. 什么是 state？—— 图中流动的数据，每个节点读它、返回要更新的部分
// 2. 什么是节点？—— 一个函数，输入 state，返回 partial state
// 3. 边的方向决定了什么？—— 数据流的顺序：START → 节点1 → 节点2 → ... → END
