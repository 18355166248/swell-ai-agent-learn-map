#!/usr/bin/env tsx
import { runAgent } from "./src/agent/index.js";
import type { AgentStreamEvent } from "./src/agent/index.js";

const args = process.argv.slice(2);

let model: string | undefined;
let maxIterations = 10;
let conversationId: string | undefined;

const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--model" || args[i] === "-m") {
    model = args[++i];
  } else if (args[i] === "--max-iterations" || args[i] === "-n") {
    maxIterations = parseInt(args[++i], 10) || 10;
  } else if (args[i] === "--conversation-id" || args[i] === "-c") {
    conversationId = args[++i];
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`用法: tsx cli.ts [选项] <任务描述>

选项:
  --model, -m <name>              指定模型 (默认读取 .env 中的 MODEL_NAME)
  --max-iterations, -n <n>        最大迭代次数 (默认: 10)
  --conversation-id, -c <id>      继续已有会话（不传则创建新会话）
  --help, -h                      显示帮助

示例:
  tsx cli.ts "分析这个项目有哪些工具函数"
  tsx cli.ts --model claude-3-5-sonnet "查看 README 内容"
  tsx cli.ts -c abc123 "再看看支付相关的逻辑"
  tsx cli.ts -n 5 "搜索 Express server 相关代码"`);
    process.exit(0);
  } else {
    positional.push(args[i]);
  }
}

const task = positional.join(" ").trim();
if (!task) {
  console.error("用法: tsx cli.ts [选项] <任务描述>");
  console.error('示例: tsx cli.ts "分析这个项目的代码结构"');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("错误: 未设置 ANTHROPIC_API_KEY 环境变量");
  console.error("请在 .env 文件中配置 ANTHROPIC_API_KEY");
  process.exit(1);
}

if (!model && !process.env.MODEL_NAME) {
  console.error("错误: 未设置 MODEL_NAME 环境变量");
  console.error("请在 .env 文件中配置 MODEL_NAME，或通过 --model 显式传入");
  process.exit(1);
}

function formatEvent(event: AgentStreamEvent) {
  switch (event.type) {
    case "thought":
      console.log(`\n💭 [轮次 ${event.iteration}]`);
      console.log(`${event.content}`);
      break;
    case "tool_call":
      console.log(`\n🔧 [轮次 ${event.iteration}] 调用工具: ${event.toolName}`);
      if (event.toolArgs && Object.keys(event.toolArgs).length > 0) {
        console.log(`参数: ${JSON.stringify(event.toolArgs, null, 2)}`);
      }
      break;
    case "tool_result": {
      const preview =
        event.content.length > 500 ? event.content.slice(0, 500) + "\n...[截断]" : event.content;
      console.log(`结果:\n${preview}`);
      break;
    }
    case "answer":
      console.log(`\n✅ 最终答案:\n${event.content}`);
      break;
    case "error":
      console.log(`\n❌ 错误: ${event.content}`);
      break;
  }
}

console.log(`📋 任务: ${task}`);
console.log(`🔧 模型: ${model || process.env.MODEL_NAME}`);
console.log(`⏳ 最大迭代: ${maxIterations}`);
console.log("─".repeat(60));

try {
  const result = await runAgent(task, {
    model,
    maxIterations,
    onEvent: formatEvent,
    conversationId,
  });

  console.log("\n" + "─".repeat(60));
  console.log(`完成: ${result.iterations} 轮迭代, ${result.steps.length} 个步骤`);
  if (result.conversationId) {
    console.log(`会话 ID: ${result.conversationId} (下次使用 -c ${result.conversationId} 继续)`);
  }
} catch (err: any) {
  console.error(`\n执行失败: ${err.message}`);
  process.exit(1);
}
