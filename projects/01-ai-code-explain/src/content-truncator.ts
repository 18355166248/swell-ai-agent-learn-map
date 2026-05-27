import { countTokens, getContextLimit, formatTokens } from "./token-counter.js";

/** 截断结果 */
export interface TruncationResult {
  /** 截断后的文件内容 */
  content: string;
  /** 原始内容的 token 数 */
  originalTokens: number;
  /** 截断后内容的 token 数 */
  truncatedTokens: number;
  /** 是否发生了截断 */
  truncated: boolean;
  /** 给用户的警告信息，未截断时为空 */
  warning: string;
}

/** 截断配置 */
export interface TruncationOptions {
  /** 模型名，用于查上下文窗口 */
  modelName?: string;
  /** 直接指定上下文窗口，测试时优先使用 */
  contextLimit?: number;
  /** 系统 prompt 内容，用于精确计算预算 */
  systemPrompt?: string;
  /** 根据候选内容构建最终用户 prompt，用于精确计算总 token */
  createPrompt?: (content: string) => string;
  /** 预留模型输出的 token 数 */
  maxOutputTokens?: number;
  /** 额外安全余量，避免实际协议开销导致擦边超限 */
  safetyMargin?: number;
  /** 头部保留占比 */
  headRatio?: number;
  /** 尾部保留占比 */
  tailRatio?: number;
}

// 默认截断参数：模型输出预留 2048 token，安全余量避免协议开销导致擦边超限
const DEFAULT_OPTIONS: Required<
  Pick<TruncationOptions, "maxOutputTokens" | "safetyMargin" | "headRatio" | "tailRatio">
> = {
  maxOutputTokens: 2048,
  safetyMargin: 1000,
  headRatio: 0.6, // 头部保留 60%，保留文件开头的 import/类型定义等关键上下文
  tailRatio: 0.3, // 尾部保留 30%
};

/**
 * 按 head/tail 比例截取行，中间用省略标记替代。
 * 优先保留文件头部（import/类型定义/导出）和尾部（关键逻辑），舍弃中间。
 */
function buildTruncatedContent(
  lines: string[],
  originalTokens: number,
  linesToKeep: number,
  headRatio: number,
  tailRatio: number,
): string {
  if (linesToKeep >= lines.length) {
    return lines.join("\n");
  }

  // 将 headRatio/tailRatio 归一化，确保两者之和为 1，避免外部传入的比例不合理
  const normalizedTotal = headRatio + tailRatio;
  const normalizedHeadRatio = normalizedTotal > 0 ? headRatio / normalizedTotal : 0.5;
  // 保留行数 <= 1 时不拆分，全给头部；否则按归一化比例分配
  const headLines =
    linesToKeep <= 1 ? linesToKeep : Math.max(1, Math.floor(linesToKeep * normalizedHeadRatio));
  const tailLines = Math.max(0, linesToKeep - headLines);

  const head = lines.slice(0, headLines).join("\n");
  const tail = tailLines > 0 ? lines.slice(-tailLines).join("\n") : "";
  const omittedLines = Math.max(0, lines.length - headLines - tailLines);
  const marker = `\n\n/* ===== [截断] 原始文件 ${formatTokens(originalTokens)} tokens，已省略中间 ${omittedLines} 行 ===== */\n\n`;
  if (!head && !tail) {
    return marker.trim();
  }
  if (!tail) {
    return head + marker;
  }
  if (!head) {
    return marker + tail;
  }
  return head + marker + tail;
}

/**
 * 判断当前内容是否在上下文预算内。
 * 总消耗 = systemPrompt + 最终 prompt（包含文件内容） + 输出预留 + 安全余量。
 */
function fitsWithinBudget(
  content: string,
  contextLimit: number,
  systemPrompt: string,
  createPrompt: (content: string) => string,
  maxOutputTokens: number,
  safetyMargin: number,
): boolean {
  const totalTokens =
    countTokens(systemPrompt) + countTokens(createPrompt(content)) + maxOutputTokens + safetyMargin;
  return totalTokens <= contextLimit;
}

/**
 * 对超过 token 限制的内容做预算感知截断。
 * 这里按“最终发给模型的真实 prompt”算 token，而不是只看裸文件内容，避免文档边界场景再次触发 context too long。
 */
export function truncateContent(
  fileContent: string,
  filePath: string,
  options: TruncationOptions = {},
): TruncationResult {
  const { maxOutputTokens, safetyMargin, headRatio, tailRatio } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const contextLimit = options.contextLimit ?? getContextLimit(options.modelName);
  const systemPrompt = options.systemPrompt || "";
  const createPrompt = options.createPrompt || ((content: string) => content);
  const originalTokens = countTokens(fileContent);

  if (
    fitsWithinBudget(
      fileContent,
      contextLimit,
      systemPrompt,
      createPrompt,
      maxOutputTokens,
      safetyMargin,
    )
  ) {
    return {
      content: fileContent,
      originalTokens,
      truncatedTokens: originalTokens,
      truncated: false,
      warning: "",
    };
  }

  // 二分查找最大可保留行数，按 head/tail 比例截取后仍能放入上下文预算
  const lines = fileContent.split("\n");
  let low = 0;
  let high = lines.length;
  let bestContent = buildTruncatedContent(lines, originalTokens, 0, headRatio, tailRatio);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = buildTruncatedContent(lines, originalTokens, mid, headRatio, tailRatio);

    if (
      fitsWithinBudget(
        candidate,
        contextLimit,
        systemPrompt,
        createPrompt,
        maxOutputTokens,
        safetyMargin,
      )
    ) {
      bestContent = candidate;
      low = mid + 1; // 能放下，尝试保留更多行
    } else {
      high = mid - 1; // 放不下，减少行数
    }
  }

  const truncatedTokens = countTokens(bestContent);
  const promptTokens = countTokens(createPrompt(bestContent));
  const availablePromptTokens = Math.max(
    0,
    contextLimit - countTokens(systemPrompt) - maxOutputTokens - safetyMargin,
  );

  return {
    content: bestContent,
    originalTokens,
    truncatedTokens,
    truncated: true,
    warning:
      `[长文档处理] ${filePath}: ${formatTokens(originalTokens)} tokens → ` +
      `${formatTokens(truncatedTokens)} tokens（prompt 可用: ${formatTokens(availablePromptTokens)}，` +
      `最终 prompt: ${formatTokens(promptTokens)}）`,
  };
}
