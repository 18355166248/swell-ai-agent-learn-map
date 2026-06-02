/**
 * 第 7 段 · 步骤 7-1：理解条件路由（用数字 example，不接 LLM）
 *
 * 这段只学：addConditionalEdges 怎么让图"循环"起来？
 *
 * 运行：npx tsx src/segment-07/step-01-conditional-edge.ts
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// ① 声明状态
const CounterState = Annotation.Root({ count: Annotation<number> });

// ② Router 函数：根据 state 决定下一步
function decideNext(state: typeof CounterState.State): "inc" | "done" {
  return state.count < 5 ? "inc" : "done";
}

// ③ 建图
const graph = new StateGraph(CounterState)
  .addNode("increment", (state) => ({ count: state.count + 1 }))
  .addNode("print", (state) => {
    console.log("当前:", state.count);
    return {};
  })
  .addEdge(START, "increment")
  .addConditionalEdges("increment", decideNext, {
    inc: "print", // decideNext 返回 "inc" → 去 print 节点
    done: END, // decideNext 返回 "done" → 图结束
  })
  .addEdge("print", "increment") // ← print 完回到 increment：这就是循环！
  .compile();

const result = await graph.invoke({ count: 0 }, { recursionLimit: 20 });
console.log("最终 count:", result.count); // 5

// 🧪 小实验：把 recursionLimit 从 20 改成 3
try {
  await graph.invoke({ count: 0 }, { recursionLimit: 3 });
} catch (e: any) {
  console.log("recursionLimit=3 时:", e.message);
  // GraphRecursionError —— 这就是手写版 maxIterations 的作用
}
