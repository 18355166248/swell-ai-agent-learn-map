import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { getConversation, createConversation, appendTurn, formatHistoryContext } from "./memory.js";
import type { ConversationMemory, ConversationTurn } from "./memory.js";
import OpenAI from "openai";
import { getToolDefinitions } from "./tools/registry";
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
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Dev Copilot",
    },
  } as any);
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
}
