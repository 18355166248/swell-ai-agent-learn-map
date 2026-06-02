/**
 * 第 7 段 · 步骤 7-2：LLM 路由器 —— shouldContinue
 *
 * 这个函数就是你手写 index.ts 第 332-411 行的声明式版本
 *
 * 运行：npx tsx src/segment-07/step-02-should-continue.ts
 */

import { MessagesAnnotation } from "@langchain/langgraph";

/**
 * 路由函数：根据最后一条消息决定下一步
 *
 * 手写对比：
 *
 * | 手写版 index.ts                                     | LangGraph 版                        |
 * | --------------------------------------------------- | ----------------------------------- |
 * | if (msg.content && !msg.tool_calls) { ... break; }  | router 返回 "__end__"              |
 * | else { continue; }                                  | router 返回 "tools"                |
 * | for (let i=1; i<=max; i++)                          | recursionLimit 配置                |
 * | messages.push(...) 在循环体里手动做                  | MessagesAnnotation 的 reducer 自动做 |
 */
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMsg = state.messages[state.messages.length - 1];

  // 检查 AIMessage 是否有 tool_calls
  if (lastMsg && "tool_calls" in lastMsg && (lastMsg as any).tool_calls?.length) {
    return "tools"; // ← 等价于 for 循环里 continue，去执行工具
  }
  return "__end__"; // ← 等价于 break，LLM 给出最终答案
}

// 这个文件主要是注解，实际使用见 step-03-react-graph.ts
console.log("shouldContinue 定义完成。它是 ReAct Agent 的核心路由逻辑。");
console.log("实际使用见 step-03-react-graph.ts");
