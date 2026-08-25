import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./prompts.js";
import { executeTool, getToolDefinitions } from "./tools/registry.js";
import { getConversation, createConversation, appendTurn, formatHistoryContext } from "./memory.js";
import type { ConversationMemory, ConversationTurn } from "./memory.js";

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
  /** 本轮会话元信息（供调用方持久化） */
  conversation?: ConversationMemory;
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

/**
 * 判断任务是否为「工具清单」类演示问题。
 * 这类问题有确定的答案范围（工具目录 + 注册表），命中后走预取/收窄逻辑，
 * 避免低成本模型在全仓库盲目 search_code 浪费轮次。
 */
function isToolInventoryTask(task: string): boolean {
  return /工具函数|工具清单|名称、参数和功能描述|列出每个工具/i.test(task);
}

/** 根据任务类型返回收窄后的搜索目录，无匹配则返回 null（不干预） */
function getTaskSearchScope(task: string): string | null {
  if (isToolInventoryTask(task)) {
    return "projects/04-dev-copilot/src/agent/tools";
  }
  if (/read_file|路径安全检查|目录穿越|executeTool|toolFactories|registry\.ts/i.test(task)) {
    return "projects/04-dev-copilot/src/agent";
  }
  return null;
}

/**
 * 演示场景的定向修正：当模型把搜索范围写成 "."、"src" 等过宽目录时，
 * 替换为按任务收窄的目标目录，提高命中效率。
 * search_docs 不涉及目录参数，直接透传。
 */
function normalizeToolArgsForTask(
  task: string,
  toolName: string,
  toolArgs: Record<string, any>,
): Record<string, any> {
  if (toolName === "search_docs") return toolArgs;

  const scopeDir = getTaskSearchScope(task);
  if (!scopeDir) return toolArgs;

  if (toolName === "list_files" || toolName === "search_code" || toolName === "grep") {
    const dir = typeof toolArgs.dir === "string" ? toolArgs.dir.trim() : "";
    if (!dir || dir === "." || dir === "src" || dir === "src/agent" || dir === "src/agent/tools") {
      return { ...toolArgs, dir: scopeDir };
    }
  }

  return toolArgs;
}

/** 解析模型名：参数显式传入优先，其次 .env 的 ANTHROPIC_MODEL_NAME，都没有则报错 */
function resolveModelName(explicitModel?: string): string {
  const model = explicitModel || process.env.ANTHROPIC_MODEL_NAME;
  if (!model) {
    throw new Error("未设置模型，请通过参数传入，或在 .env 中配置 ANTHROPIC_MODEL_NAME");
  }
  return model;
}

/** 创建 OpenAI 兼容客户端（密钥/网关地址来自环境变量，默认走 OpenRouter） */
function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    baseURL: process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/swell-ai-agent-learn-map",
      "X-Title": "Dev Copilot",
    },
  } as any);
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

  // 注入对话历史上下文（作为第二条 system 消息，让模型感知多轮语境）
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
        // tool_calls 的 arguments 是 JSON 字符串，需要解析；解析失败降级为空参数
        let toolArgs: Record<string, any>;
        try {
          toolArgs = JSON.parse(tc.function.arguments);
        } catch {
          toolArgs = {};
        }
        // 演示任务的搜索范围定向修正（见 normalizeToolArgsForTask）
        toolArgs = normalizeToolArgsForTask(task, toolName, toolArgs);

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
          // executeTool 内部已做错误包装，这里的 catch 是兜底
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

  // 达到最大迭代次数仍无答案 → 强制总结
  // 追加一条 user 指令并不带 tools 再调一次，迫使模型只输出结论
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
          model: modelName,
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

  // 保存本轮对话到会话记忆：任务 + 最终答案 + 工具调用链摘要
  if (conversation && finalAnswer) {
    const stepsSummary = steps
      .filter((s) => s.action)
      .map((s) => `${s.action!.name}(${JSON.stringify(s.action!.args).slice(0, 80)})`)
      .join(" → ");
    appendTurn(conversation.id, task, finalAnswer, stepsSummary || undefined);
    conversation = getConversation(conversation.id); // 重新加载以获取最新数据
  }

  return {
    answer: finalAnswer,
    steps,
    iterations: completedIterations,
    conversationId: conversation?.id,
    conversation: conversation ?? undefined,
  };
}
