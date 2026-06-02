/**
 * 第 3 段 · 步骤 3-2：为什么 reducer 对 ReAct Agent 至关重要
 *
 * 对照手写版 projects/04-dev-copilot/src/agent/index.ts：
 *   第 257 行：const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];
 *   第 263 行：messages.push({ role: "user", content: task });
 *   第 338 行：messages.push({ role: "assistant", content: msg.content });
 *   第 348 行：messages.push({ role: "assistant", content: null, tool_calls: ... });
 *   第 403 行：messages.push({ role: "tool", tool_call_id: tc.id, content: resultStr });
 *
 * 总共 push 了 5 种不同类型的消息：
 *   1. system  —— 系统提示词
 *   2. user    —— 用户任务
 *   3. assistant（纯文本）—— 最终答案
 *   4. assistant（含 tool_calls）—— 工具调用请求
 *   5. tool    —— 工具执行结果
 *
 * 如果 messages 不是 reducer（追加），那你每次调用 LLM 时上下文就只剩最后一条消息——
 * Agent 就"失忆"了。
 *
 * LangGraph 的 MessagesAnnotation 内置 reducer 确保每次节点的返回值
 * 被追加到已有消息数组后面，而不是覆盖。
 *
 * 注意：这不是 MemorySaver 的功劳——MemorySaver 是跨 invocation 的持久化（第 8 段），
 * 而 reducer 是单次 invocation 内部的状态累积。
 */

console.log("这个文件是注解说明，不执行代码。");
console.log("请对照阅读 projects/04-dev-copilot/src/agent/index.ts 的 messages.push 调用。");
