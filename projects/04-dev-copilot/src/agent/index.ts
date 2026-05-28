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
    maxIterations = 10,
    onEvent,
    silent = false,
    projectRoot = detectProjectRoot(),
  } = options;

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

  if (!silent) console.log(`Agent 启动: ${task.slice(0, 60)}...`);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    completedIterations = iteration;
    const response = await retryWithBackoff(() =>
      client.chat.completions.create({
        model,
        messages,
        tools,
        temperature: 0.3,
        max_tokens: 2048,
      }),
    );

    const msg = response.choices[0]?.message;
    if (!msg) {
      finalAnswer = "Agent 未返回有效响应";
      break;
    }

    // 情况 1：最终答案（有内容，没有 tool_calls）
    if (msg.content && !msg.tool_calls) {
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

        onEvent?.({
          type: "tool_call",
          content: `调用 ${toolName}`,
          iteration,
          toolName,
          toolArgs,
        });

        const rawResult = await executeTool(toolName, toolArgs, projectRoot);
        const resultStr = formatToolResult(rawResult);

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
      continue;
    }

    // 情况 3：无内容无 tool_calls（异常情况）
    finalAnswer = "Agent 未返回内容或工具调用";
    break;
  }

  // 达到最大迭代次数，强制总结
  if (!finalAnswer) {
    if (!silent) console.log("达到最大迭代次数，请求 LLM 总结...");

    messages.push({
      role: "user",
      content: "你已经收集了足够的信息。请根据以上所有工具调用的结果，给出完整的最终分析。",
    } as any);

    try {
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      });
      finalAnswer = response.choices[0]?.message?.content || "无法生成总结";
    } catch {
      finalAnswer = "达到最大迭代次数，且总结请求失败";
    }

    onEvent?.({ type: "answer", content: finalAnswer, iteration: maxIterations + 1 });
    steps.push({ iteration: maxIterations + 1, thought: "达到上限，强制总结" });
  }

  return { answer: finalAnswer, steps, iterations: completedIterations };
}
