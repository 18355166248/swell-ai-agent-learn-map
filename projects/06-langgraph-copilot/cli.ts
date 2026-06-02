/**
 * LangGraph 版 CLI 入口
 *
 * 用法：
 *   npx tsx cli.ts "分析项目结构"
 *   npx tsx cli.ts --thread thread-001 "继续上次的分析"
 *   npx tsx cli.ts --stream "你好"
 */

// dotenv 必须在所有其他 import 之前加载
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", ".env"), override: true });
config({ path: resolve(__dirname, ".env"), override: true });

// env 加载后才 import 依赖 env 的模块
const { getGraph, makeThreadId, DEFAULT_RECURSION_LIMIT, buildMessages } =
  await import("./src/agent.js");
const { JsonFileSaver } = await import("./src/json-file-saver.js");

// ============================================================
// 参数解析
// ============================================================
const args = process.argv.slice(2);

let streamMode = false;
let threadId: string | undefined;
let task = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--stream") {
    streamMode = true;
  } else if (args[i] === "--thread" && i + 1 < args.length) {
    threadId = args[++i];
  } else {
    task += (task ? " " : "") + args[i];
  }
}

if (!task.trim()) {
  console.log("用法: npx tsx cli.ts [--stream] [--thread <id>] <任务描述>");
  console.log("示例:");
  console.log('  npx tsx cli.ts "列出项目中的工具函数"');
  console.log('  npx tsx cli.ts --stream "分析项目结构"');
  console.log('  npx tsx cli.ts --thread conv-001 "继续刚才的分析"');
  process.exit(1);
}

// ============================================================
// 运行
// ============================================================
const effectiveThreadId = threadId || makeThreadId();

// 使用 JsonFileSaver 实现跨进程持久化，--thread 可以延续之前会话
const checkpointer = new JsonFileSaver(resolve(__dirname, ".checkpoints", "cli-state.json"));
const graph = getGraph(checkpointer);

const invokeConfig: any = {
  recursionLimit: DEFAULT_RECURSION_LIMIT,
  configurable: { thread_id: effectiveThreadId },
};

const input = {
  messages: await buildMessages(task.trim(), graph, effectiveThreadId),
};

if (streamMode) {
  console.log(`\n🤖 任务: ${task}`);
  console.log(`模型: ${process.env.MODEL_NAME || "claude-sonnet-4-6"}`);
  if (threadId) console.log(`会话: ${threadId}`);
  console.log("=".repeat(50));

  for await (const chunk of await graph.stream(input, {
    ...invokeConfig,
    streamMode: "updates",
  })) {
    const nodeName = Object.keys(chunk)[0];
    const nodeOutput = (chunk as any)[nodeName];

    if (nodeName === "agent" && nodeOutput.messages) {
      const msg = nodeOutput.messages[0];
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          console.log(`\n🔧 调用工具: ${tc.name}(${JSON.stringify(tc.args).slice(0, 100)})`);
        }
      } else if (msg.content) {
        console.log(`\n📝 最终答案:\n${msg.content}`);
      }
    } else if (nodeName === "tools" && nodeOutput.messages) {
      for (const toolMsg of nodeOutput.messages) {
        const preview =
          typeof toolMsg.content === "string"
            ? toolMsg.content.slice(0, 200).replace(/\n/g, "\\n")
            : "[非文本]";
        console.log(`   结果: ${preview}...`);
      }
    }
  }
} else {
  console.log(`\n🤖 任务: ${task}`);
  console.log(`模型: ${process.env.MODEL_NAME || "claude-sonnet-4-6"}`);
  if (threadId) console.log(`会话: ${threadId}`);
  console.log("=".repeat(50));

  const result = await graph.invoke(input, invokeConfig);

  console.log(`\n消息总数: ${result.messages.length}`);

  for (const msg of result.messages) {
    const type = msg.constructor.name;
    if (type === "SystemMessage") continue;
    if (type === "HumanMessage") {
      console.log(`\n[用户] ${(msg as any).content}`);
    } else if ((msg as any).tool_calls?.length) {
      const names = (msg as any).tool_calls.map((tc: any) => tc.name).join(", ");
      console.log(`[Agent] → 调用工具: ${names}`);
    } else if (type === "ToolMessage") {
      console.log(`[工具结果] ${(msg as any).content.slice(0, 100)}...`);
    } else if ((msg as any).content) {
      console.log(`\n📝 最终答案:\n${(msg as any).content}`);
    }
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log("完成");
