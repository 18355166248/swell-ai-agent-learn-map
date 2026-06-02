# Week 11：LangGraph 零基础入门

> 时间：2026-06-01 – 2026-06-07
> 状态：🟡 进行中

## 写给零基础读者

这份计划假设你**从未用过 LangGraph**，但你已经手写了 ReAct Agent（483 行的 `index.ts`）、Tool Registry（124 行的 `registry.ts`）、MemoryStore（164 行的 `memory.ts`）。

**Guarantee**：每个段落只回答一个问题。你不需要提前理解任何 LangGraph 概念——概念在用到它的那一刻才被引入。

## 学习策略

**8 段，每段只回答一个问题**：

```
第 1 段：StateGraph 是什么        → 只玩数字和字符串，不碰 LLM
第 2 段：图怎么跑起来              → compile() / invoke() / state 的入口和出口
第 3 段：state 为什么会自己累积    → MessagesAnnotation + reducer，不接模型
第 4 段：节点里怎么调模型          → ChatOpenAI + llm.invoke()，单轮问答
第 5 段：模型怎么决定调工具        → bindTools()，先观察 tool_calls 不执行
第 6 段：工具怎么被图执行          → DynamicStructuredTool + ToolNode，分两层理解
第 7 段：图怎么进入循环            → addConditionalEdges + END + recursionLimit
第 8 段：运行时能力怎么加          → stream() / MemorySaver / thread_id
```

每段产出可独立运行的 `.ts` 文件，用 `npx tsx` 直接跑。

## 技术选型

- **用什么**：`@langchain/langgraph`（TypeScript 版），`@langchain/core` 的 `DynamicStructuredTool` + `ChatOpenAI`，`zod` 做 schema
- **不学什么**（明确排除）：LangChain 的 Chain / Retriever / Agent 抽象（只取 Tool/Message 基类）、LlamaIndex、多 Agent 编排、LangSmith（可后续引入）
- **为什么现在学**：手写 ReAct 循环在条件路由下越来越复杂，Human-in-the-loop 确认逻辑无法在 ReAct 循环里优雅表达，需要框架级的状态持久化来对比自建 MemoryStore

---

## 第 1 段：StateGraph 是什么

> **这段只回答一个问题**：LangGraph 里最核心的 `StateGraph` 是什么？怎么定义一个图？
>
> **前置条件**：无。这段代码不调 LLM、不调工具，只用数字和字符串。

### 这段会学到的主概念

| 主概念              | 一句话                                         |
| ------------------- | ---------------------------------------------- |
| `Annotation.Root`   | 声明"图里流什么数据"，每个字段的类型和默认值   |
| `StateGraph`        | 图的骨架——定义有哪些节点、节点之间怎么连       |
| `addNode(name, fn)` | 注册一个节点：函数输入 state，返回要更新的字段 |
| `addEdge(from, to)` | 注册一条固定边：A 执行完总是到 B               |

### 这段会顺带看到的 API（先认识，不要求掌握）

- `START` / `END` —— 图的入口和出口标记
- `.compile()` / `.invoke()` —— 下一段专门讲

### 步骤 1-1：一个节点、一条边的图

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-01/step-01-single-node.ts`

**这段只学**：`Annotation.Root` 声明状态 → `StateGraph` 建图 → `addNode` 注册节点 → `addEdge` 连线。

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// ① 声明状态：图里流动的数据长什么样
const State = Annotation.Root({
  count: Annotation<number>, // 每个字段必须声明类型
});

// ② 建图：定义节点 + 连线
const graph = new StateGraph(State)
  .addNode("increment", (state) => ({ count: state.count + 1 }))
  .addEdge(START, "increment")
  .addEdge("increment", END)
  .compile();

// ③ 运行（invoke 的细节在第 2 段讲）
const result = await graph.invoke({ count: 0 });
console.log(result); // { count: 1 }
```

> 🧪 **小实验**：把 `+1` 改成 `*2`。再加一个"减 1"的节点，用 `addEdge` 串起来。观察数据从 START 流到 END。

### 步骤 1-2：两个节点，数据流经两个函数

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-01/step-02-two-nodes.ts`

**这段只学**：节点函数只返回自己要改的字段（partial state），LangGraph 自动合并。

```typescript
const State = Annotation.Root({
  name: Annotation<string>,
  greeting: Annotation<string>,
});

const graph = new StateGraph(State)
  .addNode("setName", (state) => ({ name: "Alice" })) // 只改 name
  .addNode("greet", (state) => ({ greeting: `Hello, ${state.name}!` })) // 只改 greeting
  .addEdge(START, "setName")
  .addEdge("setName", "greet")
  .addEdge("greet", END)
  .compile();

// 输出：{ name: "Alice", greeting: "Hello, Alice!" }
// name 在 setName 中产生，greet 中读取——数据沿边流动
```

> 🧪 **小实验**：交换两个节点的顺序。观察 `greeting` 会变成什么——这让你直观理解边的作用。

### 步骤 1-3：确认你对 StateGraph 的理解

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-01/step-03-check-understanding.ts`

一个自检练习：不用 LLM、不用工具，只用 StateGraph 实现"输入一个字符串，第一节点反转，第二节点转大写，第三节点加上长度信息"。

> 完成后你应该能回答：什么是 state？什么是节点？边的方向决定了什么？

---

## 第 2 段：图怎么跑起来

> **这段只回答一个问题**：`compile()` 和 `invoke()` 各自做什么？图从哪开始、到哪结束？

### 这段会学到的主概念

| 主概念                 | 一句话                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `compile()`            | 把图"冻结"成一个可执行对象——**编译一次，可以 invoke 多次** |
| `invoke(initialState)` | 运行图：传入初始 state → 遍历节点 → 返回最终 state         |
| `START`                | 图的入口——没有 `addEdge(START, ...)` 的图无法运行          |
| `END`                  | 图的出口——某条边指向 `END` 后，图停止执行                  |

### 步骤 2-1：编译一次，运行多次

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-02/step-01-compile-once.ts`

```typescript
const graph = new StateGraph(State)
  .addNode("toUpper", (state) => ({ text: state.text.toUpperCase() }))
  .addEdge(START, "toUpper")
  .addEdge("toUpper", END)
  .compile(); // ← 编译后 graph 不再可变

// 同一个图，不同输入，各自独立运行
console.log(await graph.invoke({ text: "hello" })); // { text: "HELLO" }
console.log(await graph.invoke({ text: "world" })); // { text: "WORLD" }
console.log(await graph.invoke({ text: "graph" })); // { text: "GRAPH" }
```

> 🧪 **小实验**：在 `compile()` 和 `invoke()` 之间尝试 `.addNode()` 会怎样？理解"编译"的含义。

### 步骤 2-2：追踪 state 在 invoke 中的变化

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-02/step-02-trace-state.ts`

**这段只学**：invoke 调用时，state 的初始值是你传入的；每个节点的返回值被合并到 state；最终 state 就是 invoke 的返回值。

> 🧪 **小实验**：定义 3 个字段的状态，3 个节点各改其中一个字段。invoke 传入只包含一个字段的初始值。观察：缺失字段使用 Annotation 的默认值、invoke 返回值是什么。

---

## 第 3 段：state 为什么会自己累积

> **这段只回答一个问题**：`MessagesAnnotation` 的 `messages` 字段和其他字段有什么不同？为什么返回新消息不会覆盖旧消息？
>
> **前置条件**：已完成第 1-2 段。**这段不接模型**——先用假消息理解 reducer。

### 这段会学到的主概念

| 主概念               | 一句话                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `MessagesAnnotation` | LangGraph 内置状态，`messages` 字段用 **reducer**（追加），不是覆盖                          |
| Reducer              | 决定"新值怎么和老值合并"的函数——`messages` 的 reducer 是 `(prev, next) => prev.concat(next)` |

### 关键认知（先读再动手）

你在手写代码里是这样管理消息的：

```typescript
// projects/04-dev-copilot/src/agent/index.ts
const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];
messages.push({ role: "user", content: task }); // 手动追加
// ... 在循环里继续 push assistant / tool 消息 ...
```

LangGraph 的做法是：定义 state 时声明 `messages` 字段用 reducer（追加逻辑），然后每次节点只需要 **return 新消息**，框架自动帮你 push。

**这不是 `MemorySaver` 的功劳——这是 `MessagesAnnotation` 内置 reducer 的行为。** MemorySaver 是第 8 段才会讲的跨 invocation 持久化，和 state 内部的 reducer 是两层机制。

### 步骤 3-1：用假消息理解 reducer

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-03/step-01-reducer.ts`

```typescript
import { StateGraph, START, END, MessagesAnnotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const graph = new StateGraph(MessagesAnnotation)
  .addNode("addMessage", (state) => {
    // state.messages 已经是所有历史消息的数组
    console.log(`当前消息数: ${state.messages.length}`);
    // 返回新消息 → 被 reducer 追加，不覆盖
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
```

> 🧪 **小实验**：把 `MessagesAnnotation` 换成 `Annotation.Root({ messages: Annotation<AIMessage[]> })`（去掉 reducer）。同样的代码，`messages` 会被覆盖而不是追加。这就让你直观理解 reducer 的作用。

### 步骤 3-2：为什么这对 ReAct Agent 至关重要

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-03/step-02-why-reducer.ts`

用一段注解说明：在你的手写循环里，`messages` 数组在每次 LLM 调用和工具执行后都会增长。如果 `messages` 不是 reducer（追加），那你每次调用 LLM 时上下文就只剩最后一条消息——Agent 就"失忆"了。

> 🧪 **小实验**：对照你手写的 `projects/04-dev-copilot/src/agent/index.ts`，找到所有 `messages.push(...)` 的地方。数一下总共 push 了几种不同类型的消息（system / user / assistant / tool / assistant-with-tool-calls）。

---

## 第 4 段：节点里怎么调模型

> **这段只回答一个问题**：怎么在图节点里调用 LLM？先做单轮问答，不接工具。
>
> **前置条件**：已完成第 1-3 段。现在该让"图"真正和 AI 对话了。

### 这段会学到的主概念

| 主概念         | 一句话                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `ChatOpenAI`   | LangChain 封装的 OpenAI 客户端，`llm.invoke(messages)` 替代你手写的 `client.chat.completions.create()` |
| `llm.invoke()` | 输入消息数组 → 返回 `AIMessage`（含 `content` 字段）                                                   |
| 在节点里调 LLM | 节点可以是 `async` 函数，内部做任意异步操作                                                            |

### 步骤 4-1：第一个 LLM 节点

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-04/step-01-first-llm-node.ts`

```typescript
import { StateGraph, START, END, MessagesAnnotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({ model: process.env.MODEL_NAME || "gpt-4o" });

const graph = new StateGraph(MessagesAnnotation)
  .addNode("askLLM", async (state) => {
    // state.messages 包含所有历史消息（感谢第 3 段讲的 reducer）
    const response = await llm.invoke(state.messages);
    return { messages: [response] }; // AIMessage 被追加到历史
  })
  .addEdge(START, "askLLM")
  .addEdge("askLLM", END)
  .compile();

const result = await graph.invoke({
  messages: [
    new SystemMessage("你是一个有帮助的助手。"),
    new HumanMessage("TypeScript 的 satisfies 关键字做什么？"),
  ],
});

// 取最后一条消息（AIMessage）的内容
const answer = result.messages[result.messages.length - 1];
console.log(answer.content);
```

> 🧪 **小实验**：对照你手写的 `index.ts` 第 288-303 行。`llm.invoke(state.messages)` 替代了 `client.chat.completions.create({ model, messages, tools })`。此时还没有 tools——那是第 5 段的内容。

### 步骤 4-2：连续多轮问答

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-04/step-02-multi-turn.ts`

利用第 3 段学的 reducer + 手动把上一次的 messages 传给下一次 invoke，实现多轮对话。

> 🧪 **小实验**：连续问 3 个有上下文依赖的问题（如"我叫 Alice""我刚才说我叫什么？""我们聊了几轮？"）。验证 LLM 能"记住"前面的对话——这靠的是 messages 累积，不是 checkpointer。

---

## 第 5 段：模型怎么决定调工具

> **这段只回答一个问题**：`.bindTools()` 做了什么？LLM 返回的 `tool_calls` 长什么样？**先观察，不执行。**
>
> **前置条件**：已完成第 4 段。

### 这段会学到的主概念

| 主概念                       | 一句话                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| `.bindTools(tools)`          | 告诉 LLM"这些工具你可以调用"，返回一个绑定了工具定义的 LLM 实例 |
| `tool_calls`                 | LLM 返回的 `AIMessage` 上可能携带的字段——表示"我要调这个工具"   |
| `AIMessage` vs `ToolMessage` | AIMessage = 模型说的话，ToolMessage = 工具执行的结果            |

### 步骤 5-1：观察 tool_calls 长什么样

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-05/step-01-bind-tools.ts`

**这段不执行工具**——只打印 LLM 返回的 AIMessage，看 `tool_calls` 的结构。

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

// 定义一个最简单的玩具工具（不实现真实逻辑）
const addTool = new DynamicStructuredTool({
  name: "add",
  description: "计算两个数的和",
  schema: z.object({ a: z.number(), b: z.number() }),
  func: async ({ a, b }) => String(a + b), // 这段先不跑
});

const llm = new ChatOpenAI({ model: process.env.MODEL_NAME || "gpt-4o" }).bindTools([addTool]);

// 问一个计算问题——LLM 应该决定调工具而不是直接回答
const response = await llm.invoke([{ role: "user", content: "3 + 5 等于多少？" }]);

console.log("content:", response.content); // 可能是空字符串
console.log("tool_calls:", response.tool_calls); // [{ name: "add", args: { a: 3, b: 5 } }]
console.log("是 AIMessage:", response.constructor.name); // AIMessage
```

> 🧪 **小实验**：问"法国首都是什么？"（不需要工具）。对比两次返回：一个含 `tool_calls`，一个只有 `content`。这就是你手写 `index.ts` 第 326/343 行 `if (msg.tool_calls?.length)` 判断的依据。

### 步骤 5-2：对照手写版的工具定义

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-05/step-02-compare-tool-defs.ts`

展示手写版和 LangChain 版对同一个工具（`read_file`）的定义差异：

```typescript
// === 手写版（registry.ts）—— 裸 JSON Schema ===
const handWritten = {
  type: "function",
  function: {
    name: "read_file",
    description: "读取指定文件的内容...",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        startLine: { type: "number" },
        endLine: { type: "number" },
      },
      required: ["path"],
    },
  },
};

// === LangChain 版 —— Zod schema（类型安全 + 自动校验） ===
const langChainTool = new DynamicStructuredTool({
  name: "read_file",
  description: "读取指定文件的内容。可以指定起始行和结束行。",
  schema: z.object({
    path: z.string().describe("文件路径，相对于项目根目录"),
    startLine: z.number().optional().describe("起始行号（1-based）"),
    endLine: z.number().optional().describe("结束行号（1-based）"),
  }),
  func: async ({ path, startLine, endLine }) => {
    // 实现逻辑复用你已有的 readFile 函数
  },
});
```

> 🧪 **小实验**：对比两者。Zod schema 比 JSON Schema 多了什么？（类型推断、describe 同时充当注释和 LLM 提示、参数校验在运行时自动执行。）

---

## 第 6 段：工具怎么被图执行

> **这段只回答一个问题**：工具的定义（`DynamicStructuredTool`）和执行（`ToolNode`）为什么是两层？`ToolNode` 自动做了什么？
>
> **前置条件**：已完成第 5 段。

### 这段会学到的主概念

| 主概念                  | 一句话                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `DynamicStructuredTool` | **定义层**：工具叫什么、参数是什么、怎么执行                                                   |
| `ToolNode`              | **执行层**：图节点，取上一条 AIMessage 的 `tool_calls`，并行执行对应工具，返回 `ToolMessage[]` |

### 为什么分两层

`DynamicStructuredTool` 可在图外直接调用（`tool.invoke({...})`），方便单独测试。`ToolNode` 是专为图设计的节点，它封装了：读取 `tool_calls` → 匹配工具 → 并行执行 → 构造 `ToolMessage` → 返回。

### 步骤 6-1：单独测试工具（不经过图）

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-06/step-01-test-tool-alone.ts`

```typescript
const addTool = new DynamicStructuredTool({
  name: "add",
  description: "计算两个数的和",
  schema: z.object({ a: z.number(), b: z.number() }),
  func: async ({ a, b }) => String(a + b),
});

// 直接调用工具——不需要图、不需要 LLM、不需要 ToolNode
const result = await addTool.invoke({ a: 3, b: 5 });
console.log(result); // "8"

// Zod 自动校验：传入错误类型会直接报错
try {
  await addTool.invoke({ a: "hello", b: 5 }); // 类型错误
} catch (e) {
  console.log("Zod 校验报错:", e.message); // 不会悄悄执行
}
```

> 🧪 **小实验**：故意传错参数类型、缺参数、多传参数。观察 Zod 的报错信息——这些校验在你手写的 registry.ts 里不存在。

### 步骤 6-2：ToolNode 在图中执行工具

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-06/step-02-tool-node-in-graph.ts`

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";

const tools = [addTool, multiplyTool]; // 工具定义（第 5 段学的）
const toolNode = new ToolNode(tools); // 执行节点

// ToolNode 做了什么（阅读即可，不需要你手写）：
// 1. 取 state.messages 最后一条 AIMessage
// 2. 检查 AIMessage.tool_calls
// 3. 对每个 tool_call：匹配工具 → 执行 func → 构造 ToolMessage
// 4. 返回 { messages: [ToolMessage, ToolMessage, ...] }
```

- **手写对应关系**：`ToolNode` 替代了你 `index.ts` 中 **工具调用主循环** 的部分（遍历 `msg.tool_calls`、解析 JSON、调用 `executeTool`、构造 tool 消息）。但**你手写的业务定制逻辑仍然需要自己补**——包括：`normalizeToolArgsForTask`（参数归一化，第 75 行）、`formatToolResult`（结果截断，第 149 行）、`onEvent` 回调（流式事件，第 366-394 行）。

> 🧪 **小实验**：写两个工具（add 和 multiply），在 ToolNode 中注册。模拟一条含有多个 tool_calls 的 AIMessage 传给 ToolNode，观察是否并行执行。

---

## 第 7 段：图怎么进入循环

> **这段只回答一个问题**：`addConditionalEdges` 怎么让图"循环"起来？这和你手写的 `for + if/else` 怎么对应？
>
> **前置条件**：已完成第 1-6 段。现在可以拼出完整的 ReAct 循环了。

### 这段会学到的主概念

| 主概念                                   | 一句话                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `addConditionalEdges(node, router, map)` | 从节点出发，根据 router 函数的返回值决定下一步去哪                           |
| Router 函数                              | `(state) => string`，根据 state 返回下一步目标                               |
| `"__end__"`                              | Router 返回这个值时，图停止（等价于手写的 `break`）                          |
| `recursionLimit`                         | 最大执行步数（等价于手写的 `maxIterations`），超出抛出 `GraphRecursionError` |

### 步骤 7-1：理解条件路由（用数字 example，不接 LLM）

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-07/step-01-conditional-edge.ts`

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// ① 声明状态——这一步不能省
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

// 运行：count 从 0 开始 → increment → print → ... 直到 count >= 5 时结束
const result = await graph.invoke({ count: 0 }, { recursionLimit: 20 });
// 输出：1, 2, 3, 4（count 增到 5 时 decideNext 直接走 done，没轮到 print）→ result.count === 5
```

> 🧪 **小实验**：把 `recursionLimit` 从 20 改成 3。观察 `GraphRecursionError` 被抛出——这就是你手写版 `maxIterations` 的作用。

### 步骤 7-2：LLM 路由器 —— shouldContinue

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-07/step-02-should-continue.ts`

```typescript
// 这个函数就是你手写 index.ts 第 332-411 行的声明式版本
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const lastMsg = state.messages[state.messages.length - 1];

  // 检查 AIMessage 是否有 tool_calls
  if (lastMsg && "tool_calls" in lastMsg && lastMsg.tool_calls?.length) {
    return "tools"; // ← 等价于 for 循环里 continue，去执行工具
  }
  return "__end__"; // ← 等价于 break，LLM 给出最终答案
}
```

- **手写对比**：

| 手写版 `index.ts`                                    | LangGraph 版                           |
| ---------------------------------------------------- | -------------------------------------- |
| `if (msg.content && !msg.tool_calls) { ... break; }` | router 返回 `"__end__"`                |
| `else { continue; }`                                 | router 返回 `"tools"`                  |
| `for (let i=1; i<=max; i++)`                         | `recursionLimit` 配置                  |
| `messages.push(...)` 在循环体里手动做                | `MessagesAnnotation` 的 reducer 自动做 |

### 步骤 7-3：完整的 ReAct 图（Agent → 路由 → Tools → 循环）

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-07/step-03-react-graph.ts`

```typescript
const llm = new ChatOpenAI({
  model: process.env.MODEL_NAME || "gpt-4o",
  temperature: 0.3,
}).bindTools(tools);
const toolNode = new ToolNode(tools);

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", async (state) => {
    const response = await llm.invoke(state.messages);
    return { messages: [response] };
  })
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, { tools: "tools", __end__: END })
  .addEdge("tools", "agent") // ← 循环回 agent：工具结果返回给 LLM 继续思考
  .compile();

// invoke 时在系统消息后放入用户问题
const result = await graph.invoke(
  { messages: [new SystemMessage("..."), new HumanMessage("分析项目结构")] },
  { recursionLimit: 13 }, // agent→tools→agent→tools→... = 2 步/轮，13 步 ≈ 6 轮
);
```

> 🧪 **小实验**：对照你手写的 `runAgent()` 函数（`index.ts` 第 219-483 行），逐行确认每个概念的对齐：
>
> - `messages` 数组 → `MessagesAnnotation` 的 reducer
> - `client.chat.completions.create()` → `llm.invoke()`
> - `msg.tool_calls` 判断 → `shouldContinue` router
> - `executeTool()` → `ToolNode`
> - `for` 循环上限 → `recursionLimit`
> - `break` → `"__end__"`
> - `continue` → `addEdge("tools", "agent")`
>
> 你手写的 ~60 行核心循环逻辑收缩成了 4 条边。

---

## 第 8 段：运行时能力怎么加

> **这段回答**：图主体稳定后，怎么加流式输出（stream）、怎么加跨 invocation 持久化（MemorySaver）。
>
> **前置条件**：第 7 段的完整 ReAct 图已能跑通。以下每个子主题是**独立可选**的——先学哪个都可以。
>
> **⚠️ 观念先纠正**：
>
> - `MemorySaver` 保存的是 **graph state**（整个 `state.messages` 数组），不是你手写 MemoryStore 里存的 Q&A 摘要
> - system prompt 是否每轮重放取决于**你的 agent 实现**（是否把 system prompt 放进初始 messages），不是 `MemorySaver` 的固有行为
> - `stream` 是输出方式，`MemorySaver` 是状态持久化，**两者互不依赖**

### 8-A：流式输出

#### 步骤 8A-1：三种最常用的 stream mode

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-08/step-stream-01-modes.ts`

> 注意：LangGraph.js 支持多种 stream mode（`values`, `updates`, `messages`, `events`, `debug`, `tasks`, `checkpoints`, `custom`, `messages-tuple` 等）。这里先学 3 种最常用的。

| Mode         | 每次 yield 什么                                       | 适用场景                   |
| ------------ | ----------------------------------------------------- | -------------------------- |
| `"values"`   | 完整 state 快照                                       | 调试，看每一步后的全局状态 |
| `"updates"`  | 只返回这一步改了什么 `{ agent: { messages: [...] } }` | 前端渲染"这一步做了什么"   |
| `"messages"` | LLM token 级流式（需 `streaming: true`）              | 打字机效果                 |

```typescript
// values 模式：拿完整状态
for await (const chunk of await graph.stream(input, { streamMode: "values" })) {
  console.log("完整消息数:", chunk.messages.length);
}

// updates 模式：只看增量
for await (const chunk of await graph.stream(input, { streamMode: "updates" })) {
  console.log("这一步的输出:", Object.keys(chunk)); // { agent: { messages: [...] } }
}

// messages 模式：token 级流式
const llm = new ChatOpenAI({
  model: process.env.MODEL_NAME || "gpt-4o",
  streaming: true,
}).bindTools(tools);
for await (const [msg, metadata] of await graph.stream(input, { streamMode: "messages" })) {
  // msg 是 AIMessageChunk，逐 token 到达
}
```

> 🧪 **小实验**：同一查询用 3 种模式分别跑。记录每种模式每步的 chunk 数量。

#### 步骤 8A-2：包装成 SSE 端点

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-08/step-stream-02-sse.ts`

把 LangGraph stream 包装成 Express SSE 端点。对比你手写版 `server.ts` 的 `onEvent` 回调模式：LangGraph 的 async iterator 和手写的 callback 是两种不同的消费方式，各有适用场景。

### 8-B：跨 invocation 持久化（MemorySaver）

#### 步骤 8B-1：MemorySaver 保存的是什么

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-08/step-memory-01-basics.ts`

```typescript
import { MemorySaver } from "@langchain/langgraph";

// MemorySaver 是一个 checkpointer：它为每个 thread_id 保存 graph state
const checkpointer = new MemorySaver();
const graph = buildReactGraph().compile({ checkpointer });

// 配置 thread_id —— 类似你手写的 conversationId
const config = { configurable: { thread_id: "conv-001" } };

// 第一次 invoke：graph state 被 checkpoint
await graph.invoke(
  {
    messages: [new SystemMessage("你是一个有帮助的助手。"), new HumanMessage("我叫 Alice")],
  },
  config,
);

// 第二次 invoke：graph 从上次的 checkpoint 恢复 state
// 所以 messages 自动包含第一轮的全部历史
await graph.invoke(
  {
    messages: [new HumanMessage("我刚才说我叫什么？")],
  },
  config,
);
// LLM 回答 "Alice" —— 因为 full history 在 checkpoint 里
```

**关键认知**（与手写版对比）：

| 维度          | 手写 MemoryStore（`memory.ts`）                   | LangGraph `MemorySaver`                                                                                                      |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 存什么        | 每轮 Q&A 摘要 + steps 摘要                        | **完整的 graph state**（含所有 messages、tool_calls、tool results）                                                          |
| 持久化        | 文件 JSON（重启不丢）                             | 内存（重启丢失，生产可用 `SqliteSaver` 等）                                                                                  |
| 标识          | `conversationId` 参数                             | `configurable.thread_id`                                                                                                     |
| 注入方式      | 手动调 `formatHistoryContext` 构造 system message | 框架自动从 checkpoint 恢复 state                                                                                             |
| system prompt | 每次自己拼                                        | **题目取决于你的实现**：如果你把 system prompt 放进初始 messages，checkpoint 里就有它；如果你每次在外层加，checkpoint 里没有 |

> 🧪 **小实验**：同 thread_id 连续 invoke 两次，打印 `state.messages.length`。对比手写 MemoryStore 的 `formatHistoryContext`：前者存了所有中间消息，后者只存了最终 Q&A 摘要。讨论各自的 token 消耗和上下文质量差异。

#### 步骤 8B-2：Thread 管理

- [ ] 创建 `projects/06-langgraph-copilot/src/segment-08/step-memory-02-threads.ts`

- `graph.getState(config)` — 查看某 thread 的当前 state
- 多个 thread_id 并发对话，验证隔离性

> 🧪 **小实验**：创建 3 个 thread 并发对话，各自独立发展。用 `getState` 验证互不干扰。

---

## 最终产物：对比评估

> **目标**：把这 8 段学到的 LangGraph Agent 和你手写版 Agent 用同一套评估任务跑一遍，产出结构化对比。

### 需要创建的最终文件

| 文件                                                         | 性质     | 说明                                 |
| ------------------------------------------------------------ | -------- | ------------------------------------ |
| `projects/06-langgraph-copilot/src/agent.ts`                 | 最终产物 | 第 7 段 React 图的生产版             |
| `projects/06-langgraph-copilot/src/tools.ts`                 | 最终产物 | 第 6 段迁移后的工具定义              |
| `projects/06-langgraph-copilot/src/server.ts`                | 最终产物 | 第 8 段 SSE + MemorySaver 的完整服务 |
| `projects/06-langgraph-copilot/cli.ts`                       | 最终产物 | CLI 入口                             |
| `experiments/langgraph-vs-handwritten/README.md`             | 对比报告 | 两种方案的对比结论                   |
| `experiments/langgraph-vs-handwritten/round-01-results.json` | 评估数据 | 同一套任务集两版通过率               |

> 注意：上面 8 段中的 `step-*.ts` 文件是**练习脚本**（帮你逐步理解 API），上面的 `agent.ts` / `server.ts` 是**最终产物**。练习脚本可在最终产物完成后删除或保留作参考。

### 对比维度

- [ ] 用 `experiments/agent-evals/agent-eval-round-01.json` 的 5 个任务分别跑两版 Agent
- [ ] 对比通过率、迭代次数、token 消耗、答案质量
- [ ] 产出对比报告，回答"什么时候手写更好？什么时候框架更好？"

### 统计口径说明

手写版代码行数（不含空行和注释的估算以 `wc -l` 为准）：

| 文件                      | 行数    | 职责            |
| ------------------------- | ------- | --------------- |
| `agent/index.ts`          | 483     | Agent 核心循环  |
| `agent/tools/registry.ts` | 124     | 工具注册        |
| `agent/memory.ts`         | 164     | 对话记忆        |
| **核心逻辑合计**          | **771** |                 |
| `server.ts`               | 153     | HTTP + SSE 服务 |
| **含服务层合计**          | **924** |                 |

LangGraph 版的目标是**用 ~200 行核心代码完成同等功能**。对比时建议拆开看：核心 Agent 逻辑的收敛比例 vs 加上服务层后的整体收敛比例。

---

## 项目文件结构

```
projects/06-langgraph-copilot/
  package.json                    # @langchain/langgraph, @langchain/openai, @langchain/core, zod, dotenv, express
  tsconfig.json
  .env                            # 复用 04-dev-copilot 的配置
  cli.ts                          # CLI 入口（最终产物）
  src/
    agent.ts                      # 最终产物：生产版 Agent 图
    tools.ts                      # 最终产物：迁移后的工具定义
    server.ts                     # 最终产物：完整 Agent 服务
    segment-01/                   # 第 1 段：StateGraph 是什么
      step-01-single-node.ts
      step-02-two-nodes.ts
      step-03-check-understanding.ts
    segment-02/                   # 第 2 段：图怎么跑起来
      step-01-compile-once.ts
      step-02-trace-state.ts
    segment-03/                   # 第 3 段：state 为什么自己累积
      step-01-reducer.ts
      step-02-why-reducer.ts
    segment-04/                   # 第 4 段：节点里怎么调模型
      step-01-first-llm-node.ts
      step-02-multi-turn.ts
    segment-05/                   # 第 5 段：模型怎么决定调工具
      step-01-bind-tools.ts
      step-02-compare-tool-defs.ts
    segment-06/                   # 第 6 段：工具怎么被图执行
      step-01-test-tool-alone.ts
      step-02-tool-node-in-graph.ts
    segment-07/                   # 第 7 段：图怎么进入循环
      step-01-conditional-edge.ts
      step-02-should-continue.ts
      step-03-react-graph.ts
    segment-08/                   # 第 8 段：运行时能力
      step-stream-01-modes.ts
      step-stream-02-sse.ts
      step-memory-01-basics.ts
      step-memory-02-threads.ts

experiments/langgraph-vs-handwritten/
  README.md                       # 对比报告
  round-01-results.json           # 评估结果
```

## 参考资料

- [LangGraph.js 官方文档](https://langchain-ai.github.io/langgraphjs/)
- [LangGraph.js Quick Start](https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/)
- 手写 Agent 源码：`projects/04-dev-copilot/src/agent/index.ts`（483 行，对照阅读）
- [MessagesAnnotation API](https://langchain-ai.github.io/langgraphjs/reference/variables/langgraph.MessagesAnnotation.html)
- [StreamMode 类型定义](https://langchain-ai.github.io/langgraphjs/reference/types/langgraph-sdk.StreamMode.html)
- [GraphRecursionError](https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.GraphRecursionError.html)
