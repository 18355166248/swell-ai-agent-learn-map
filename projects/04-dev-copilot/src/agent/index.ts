import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompts.js";
import { executeTool, getToolDefinitions } from "./tools/registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", "..", ".env"), override: false });

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b:free";
const MAX_TOOL_RESULT_CHARS = 8000;
/** 单次 LLM 请求超时（毫秒） */
const LLM_TIMEOUT = 90_000;
/** 单次工具调用超时（毫秒） */
const TOOL_TIMEOUT = 30_000;

export interface AgentStep {
  iteration: number;
  thought: string;
  action?: { name: string; args: Record<string, any> };
  observation?: string;
  error?: string;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  iterations: number;
}

export interface AgentStreamEvent {
  type: "thought" | "tool_call" | "tool_result" | "answer" | "error";
  content: string;
  iteration: number;
  toolName?: string;
  toolArgs?: Record<string, any>;
}

export interface AgentOptions {
  model?: string;
  maxIterations?: number;
  onEvent?: (event: AgentStreamEvent) => void;
  silent?: boolean;
  projectRoot?: string;
  /** 全局超时（毫秒），默认 300s */
  timeout?: number;
}

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Dev Copilot",
    },
  } as any);
}

function detectProjectRoot(): string {
  let dir = resolve(__dirname);
  for (let i = 0; i < 10; i++) {
    const pkgPath = resolve(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "swell-ai-agent-learn-map") return dir;
      } catch {
        /* not valid JSON */
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, "..", "..", "..", "..");
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

function formatToolResult(raw: string): string {
  if (raw.length <= MAX_TOOL_RESULT_CHARS) return raw;
  return raw.slice(0, MAX_TOOL_RESULT_CHARS) + `\n\n...[截断，共 ${raw.length} 字符]`;
}

export async function runAgent(task: string, options: AgentOptions = {}): Promise<AgentResult> {
  const {
    model = DEFAULT_MODEL,
    maxIterations = 6,
    onEvent,
    silent = false,
    projectRoot = detectProjectRoot(),
    timeout = 300_000,
  } = options;

  // 全局超时：通过 AbortController 在所有 LLM 调用间共享
  const abortController = new AbortController();
  const globalTimer = setTimeout(() => abortController.abort(), timeout);
  if (globalTimer.unref) globalTimer.unref();

  const tools = getToolDefinitions();
  const client = getClient();

  type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task },
  ];

  const steps: AgentStep[] = [];
  let finalAnswer = "";
  let completedIterations = 0;

  const log = (...args: any[]) => {
    if (!silent) console.log(`[ReAct]`, ...args);
  };

  log(`========== Agent 启动 ==========`);
  log(`任务: ${task.slice(0, 120)}${task.length > 120 ? "..." : ""}`);
  log(`模型: ${model} | 最大迭代: ${maxIterations} | 工具数: ${tools.length}`);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    completedIterations = iteration;

    log(`---------- 迭代 ${iteration}/${maxIterations} ----------`);
    log(`发送请求 → 消息数: ${messages.length} | 工具数: ${tools.length}`);

    const t0 = Date.now();
    const response = await retryWithBackoff(() =>
      client.chat.completions.create(
        {
          model,
          messages,
          tools,
          temperature: 0.3,
          max_tokens: 2048,
        },
        {
          // 组合全局超时和单次调用超时
          signal: abortController.signal,
        },
      ),
    );
    const latency = Date.now() - t0;

    const msg = response.choices[0]?.message;
    if (!msg) {
      finalAnswer = "Agent 未返回有效响应";
      log(`✗ 空响应`);
      break;
    }

    const finishReason = response.choices[0]?.finish_reason;
    const usage = response.usage;
    log(
      `LLM 响应 ← finish: ${finishReason} | ` +
        `tokens: ${usage?.prompt_tokens ?? "?"}→${usage?.completion_tokens ?? "?"} ` +
        `(总计 ${usage?.total_tokens ?? "?"}) | 耗时: ${latency}ms`,
    );

    if (msg.content) {
      const preview = msg.content.slice(0, 150).replace(/\n/g, "\\n");
      log(`content 预览: ${preview}${msg.content.length > 150 ? "..." : ""}`);
    }

    if (msg.tool_calls?.length) {
      log(
        `tool_calls: [${msg.tool_calls.map((tc) => `${tc.function.name}(${tc.function.arguments.slice(0, 80)})`).join(", ")}]`,
      );
    }

    // 情况 1：最终答案（有内容，没有 tool_calls）
    if (msg.content && !msg.tool_calls) {
      log(`>>> 最终答案 (${msg.content.length} 字符)`);
      steps.push({ iteration, thought: msg.content });
      onEvent?.({ type: "answer", content: msg.content, iteration });
      finalAnswer = msg.content;
      messages.push({ role: "assistant", content: msg.content });
      break;
    }

    // 情况 2：工具调用
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const thought = msg.content || "调用工具获取更多信息...";
      onEvent?.({ type: "thought", content: thought, iteration });

      // 推送 assistant message（含 tool_calls）
      messages.push({
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      } as any);

      for (const tc of msg.tool_calls) {
        const toolName = tc.function.name;
        let toolArgs: Record<string, any>;
        try {
          toolArgs = JSON.parse(tc.function.arguments);
        } catch {
          toolArgs = {};
        }

        log(`🔧 调用工具: ${toolName} ${JSON.stringify(toolArgs).slice(0, 120)}`);

        onEvent?.({
          type: "tool_call",
          content: `调用 ${toolName}`,
          iteration,
          toolName,
          toolArgs,
        });

        const toolT0 = Date.now();
        let rawResult: string;
        try {
          rawResult = await executeTool(toolName, toolArgs, projectRoot);
        } catch (toolErr: any) {
          rawResult = `工具执行异常: ${toolErr.message}`;
          log(`   ⚠ 工具异常: ${toolErr.message}`);
        }
        const toolLatency = Date.now() - toolT0;
        const resultStr = formatToolResult(rawResult);

        log(
          `   工具返回: ${rawResult.length} 字符 (截断后 ${resultStr.length}) | 耗时: ${toolLatency}ms`,
        );
        if (resultStr.length >= 50) {
          log(`   结果预览: ${resultStr.slice(0, 150).replace(/\n/g, "\\n")}...`);
        } else {
          log(`   结果: ${resultStr.replace(/\n/g, "\\n")}`);
        }

        onEvent?.({ type: "tool_result", content: resultStr, iteration, toolName });

        steps.push({
          iteration,
          thought,
          action: { name: toolName, args: toolArgs },
          observation: resultStr,
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultStr,
        } as any);
      }

      log(`迭代 ${iteration} 完成 → 消息总数: ${messages.length}`);
      continue;
    }

    // 情况 3：无内容无 tool_calls（异常情况）
    log(`✗ 无 content 也无 tool_calls，终止循环`);
    finalAnswer = "Agent 未返回内容或工具调用";
    break;
  }

  // 达到最大迭代次数，强制总结
  if (!finalAnswer) {
    log(`>>> 达到最大迭代次数 (${maxIterations})，请求 LLM 强制总结...`);

    messages.push({
      role: "user",
      content: "你已经收集了足够的信息。请根据以上所有工具调用的结果，给出完整的最终分析。",
    } as any);

    try {
      const t0 = Date.now();
      const response = await client.chat.completions.create(
        {
          model,
          messages,
          temperature: 0.3,
          max_tokens: 2048,
        },
        { signal: abortController.signal },
      );
      finalAnswer = response.choices[0]?.message?.content || "无法生成总结";
      log(`强制总结完成 | 耗时: ${Date.now() - t0}ms | ${finalAnswer.length} 字符`);
    } catch {
      finalAnswer = "达到最大迭代次数，且总结请求失败";
      log(`✗ 强制总结失败`);
    }

    onEvent?.({ type: "answer", content: finalAnswer, iteration: maxIterations + 1 });
    steps.push({ iteration: maxIterations + 1, thought: "达到上限，强制总结" });
  }

  log(`========== Agent 结束 ==========`);
  log(
    `总迭代: ${completedIterations} | 总步骤: ${steps.length} | 答案长度: ${finalAnswer.length} 字符`,
  );
  if (steps.filter((s) => s.action).length > 0) {
    log(
      `工具调用明细: ${steps
        .filter((s) => s.action)
        .map((s) => s.action!.name)
        .join(" → ")}`,
    );
  }

  clearTimeout(globalTimer);
  return { answer: finalAnswer, steps, iterations: completedIterations };
}
