import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { getConversation, createConversation, appendTurn, formatHistoryContext } from "./memory.js";
import type { ConversationMemory, ConversationTurn } from "./memory.js";
import OpenAI from "openai";
import { executeTool, getToolDefinitions } from "./tools/registry";
import { SYSTEM_PROMPT } from "./prompts";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: resolve(__dirname, "..", "..", "..", "..", ".env"), override: false });
config({ path: resolve(__dirname, "..", "..", ".env"), override: false });

/** 默认 LLM 网关地址（OpenRouter，兼容 OpenAI 协议） */
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
/** 单个工具结果注入 messages 前的最大字符数，超出则截断，避免撑爆上下文 */
const MAX_TOOL_RESULT_CHARS = 8000;
/** 单次 LLM 请求超时（毫秒） */
const LLM_TIMEOUT = 90_000;
/** 单次工具调用超时（毫秒） */
const TOOL_TIMEOUT = 30_000;

/** Agent 执行轨迹中的一步（ReAct 中的一个 Thought-Action-Observation） */
export interface AgentStep {
  /** 所属主循环轮次（1-based） */
  iteration: number;
  /** 本步的思考内容（LLM 的 content 或默认占位文案） */
  thought: string;
  /** 本步调用的工具及参数 */
  action?: { name: string; args: Record<string, any> };
  /** 工具返回的结果（截断后） */
  observation?: string;
  /** 预留：步骤级错误信息 */
  error?: string;
}

export interface AgentResult {
  answer: string;
  steps: AgentStep[];
  iterations: number;
  /** 会话 ID（如果启用了记忆） */
  conversationId?: string;
}

/** 流式事件 — 由 onEvent 回调推送，供 CLI / SSE 实时展示执行轨迹 */
export interface AgentStreamEvent {
  type: "thought" | "tool_call" | "tool_result" | "answer" | "error";
  content: string;
  iteration: number;
  /** 仅 tool_call / tool_result 事件携带 */
  toolName?: string;
  /** 仅 tool_call 事件携带 */
  toolArgs?: Record<string, any>;
}

/** runAgent 的可选配置 */
export interface AgentOptions {
  /** 覆盖 .env 中的模型名 */
  model?: string;
  /** 主循环最大轮数（注意：是循环轮数，不是工具调用次数） */
  maxIterations?: number;
  /** 流式事件回调（CLI 彩色输出 / SSE 都基于它） */
  onEvent?: (event: AgentStreamEvent) => void;
  /** 静默模式：关闭 [ReAct] 调试日志 */
  silent?: boolean;
  /** 文件工具的项目根目录，默认自动检测 */
  projectRoot?: string;
  /** 全局超时（毫秒），默认 300s */
  timeout?: number;
  /** 会话 ID — 传入已有 ID 则继续该会话，否则创建新会话 */
  conversationId?: string;
}

/** 向上逐级查找 name 为 swell-ai-agent-learn-map 的 package.json，定位仓库根目录 */
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

/** 解析模型名：参数显式传入优先，其次 .env 的 OPENAI_MODEL_NAME，都没有则报错 */
function resolveModelName(explicitModel?: string): string {
  const model = explicitModel || process.env.OPENAI_MODEL_NAME;
  if (!model) {
    throw new Error("未设置模型，请通过参数传入，或在 .env 中配置 OPENAI_MODEL_NAME");
  }
  return model;
}

/** 创建 OpenAI 兼容客户端（密钥/网关地址来自环境变量，默认走 OpenRouter） */
function getClient(): OpenAI {
  console.log("创建 OpenAI 客户端", {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Dev Copilot",
    },
  } as any);
}

/** 指数退避重试：失败后按 1s/2s/4s 间隔重试，用于应对 LLM 网关的瞬时抖动 */
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

/**
 * 判断任务是否为「工具清单」类演示问题。
 * 这类问题有确定的答案范围（工具目录 + 注册表），命中后走预取/收窄逻辑，
 * 避免低成本模型在全仓库盲目 search_code 浪费轮次。
 */
function isToolInventoryTask(task: string): boolean {
  return /工具函数|工具清单|名称、参数和功能描述|列出每个工具/i.test(task);
}

/** 工具结果超长时截断到 MAX_TOOL_RESULT_CHARS，并标注原始长度 */
function formatToolResult(raw: string): string {
  if (raw.length <= MAX_TOOL_RESULT_CHARS) return raw;
  return raw.slice(0, MAX_TOOL_RESULT_CHARS) + `\n\n...[截断，共 ${raw.length} 字符]`;
}

/**
 * 「工具清单」类问题的上下文预取：在进入 LLM 循环前，
 * 直接执行 list_files + read_file(registry.ts)，把结果作为额外 user 消息注入。
 * 这是针对演示任务的捷径优化，普通任务返回 null 不生效。
 */
async function preloadToolInventoryContext(
  task: string,
  projectRoot: string,
  steps: AgentStep[],
  onEvent?: (event: AgentStreamEvent) => void,
): Promise<string | null> {
  if (!isToolInventoryTask(task)) return null;

  const preloadPlan = [
    {
      toolName: "list_files",
      toolArgs: { dir: "projects/04-dev-copilot/src/agent/tools" },
      note: "预取工具目录结构",
    },
    {
      toolName: "read_file",
      toolArgs: {
        path: "projects/04-dev-copilot/src/agent/tools/registry.ts",
        startLine: 1,
        endLine: 220,
      },
      note: "预取工具注册表",
    },
  ] as const;

  const sections: string[] = [];
  for (const item of preloadPlan) {
    onEvent?.({
      type: "tool_call",
      content: item.note,
      iteration: 0,
      toolName: item.toolName,
      toolArgs: item.toolArgs as Record<string, any>,
    });

    const rawResult = await executeTool(
      item.toolName,
      item.toolArgs as Record<string, any>,
      projectRoot,
    );
    const observation = formatToolResult(rawResult);

    onEvent?.({
      type: "tool_result",
      content: observation,
      iteration: 0,
      toolName: item.toolName,
    });

    steps.push({
      iteration: 0,
      thought: item.note,
      action: { name: item.toolName, args: item.toolArgs as Record<string, any> },
      observation,
    });
    sections.push(`### ${item.note}\n${observation}`);
  }

  return [
    "系统已预取与工具清单问题直接相关的代码上下文。请优先基于这些结果完成分析，避免重新回到无范围的 search_code 盲搜。",
    "如果信息仍不足，再补充读取具体工具实现文件，但不要忽略 registry.ts 中的工具定义。",
    ...sections,
  ].join("\n\n");
}

/**
 * ReAct Agent 主入口。
 *
 * 循环流程：
 * 1. messages = [system, (历史上下文), user, (预取上下文)]
 * 2. while (iteration <= maxIterations):
 *    - 调 LLM（带 tools）
 *    - 有 content 无 tool_calls → 最终答案，结束
 *    - 有 tool_calls → 逐个执行工具，结果以 role:"tool" 消息回填，继续下一轮
 * 3. 超过 maxIterations 仍未得到答案 → 追加总结指令，不带 tools 再调一次
 */
export async function runAgent(task: string, options: AgentOptions = {}): Promise<AgentResult> {
  const {
    model,
    maxIterations = 6,
    onEvent,
    silent = false,
    projectRoot = detectProjectRoot(),
    timeout = 300_000,
    conversationId,
  } = options;

  const modelName = resolveModelName(model);

  console.log("modelName", modelName);

  // ---------- 会话记忆 ----------
  // 三种情况：传入已有 ID（命中则续聊）、传入不存在 ID（新建会话）、未传 ID（新建会话）
  let conversation: ConversationMemory | null = null;
  if (conversationId) {
    conversation = getConversation(conversationId);
  }
  if (!conversation && conversationId) {
    // 传入的 ID 不存在，创建新的
    conversation = createConversation(task);
  } else if (!conversation && conversationId === undefined) {
    // 未传 ID，自动创建新会话
    conversation = createConversation(task);
  }
  const historyContext = conversation ? formatHistoryContext(conversation) : null;
  // -------------------------------

  // 全局超时：通过 AbortController 在所有 LLM 调用间共享
  const abortController = new AbortController();
  const globalTimer = setTimeout(() => abortController.abort(), timeout);
  if (globalTimer.unref) globalTimer.unref();

  const tools = getToolDefinitions();
  const client = getClient();

  type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;

  const steps: AgentStep[] = [];

  // 初始消息序列：系统 Prompt → 会话历史（如有）→ 用户任务
  const messages: Message[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (historyContext) {
    messages.push({ role: "system", content: historyContext });
  }

  messages.push({ role: "user", content: task });

  // 演示任务的上下文预取（见 preloadToolInventoryContext），普通任务为 null
  const preloadedContext = await preloadToolInventoryContext(task, projectRoot, steps, onEvent);
  if (preloadedContext) {
    messages.push({ role: "user", content: preloadedContext });
  }

  let finalAnswer = "";
  let completedIterations = 0;

  const log = (...args: any[]) => {
    if (!silent) console.log(`[ReAct]`, ...args);
  };

  log(`========== Agent 启动 ==========`);
  log(`任务: ${task.slice(0, 120)}${task.length > 120 ? "..." : ""}`);
  log(`模型: ${modelName} | 最大迭代: ${maxIterations} | 工具数: ${tools.length}`);

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    completedIterations = iteration;

    log(`---------- 迭代 ${iteration}/${maxIterations} ----------`);
    log(`发送请求 → 消息数: ${messages.length} | 工具数: ${tools.length}`);

    const t0 = Date.now();
    const response = await retryWithBackoff(() =>
      client.chat.completions.create(
        {
          model: modelName,
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
  }
}
