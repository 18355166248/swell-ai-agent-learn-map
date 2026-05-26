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
interface TruncationConfig {
  /** 模型上下文窗口总大小 */
  contextLimit: number;
  /** 系统 prompt 的 token 数 */
  systemPromptTokens: number;
  /** 用户 prompt 模板（不含文件内容）的 token 数 */
  promptTemplateTokens: number;
  /** 预留模型输出的 max_tokens */
  maxOutputTokens: number;
  /** 安全余量 */
  safetyMargin: number;
}

function computeAvailable(config: TruncationConfig): number {
  return (
    config.contextLimit -
    config.systemPromptTokens -
    config.promptTemplateTokens -
    config.maxOutputTokens -
    config.safetyMargin
  );
}

/**
 * 对超过 token 限制的文件内容进行智能截断
 * 策略：保留文件头部（import/类型定义）和尾部（导出/核心逻辑），中间截断并插入标记
 */
export function truncateContent(
  fileContent: string,
  filePath: string,
  modelName?: string,
): TruncationResult {
  const originalTokens = countTokens(fileContent);
  const contextLimit = getContextLimit(modelName);

  // 预留：system prompt (估算400) + prompt template overhead (估算200) + max_tokens (2048) + safety (1000)
  const reserved = 400 + 200 + 2048 + 1000;
  const available = contextLimit - reserved;

  if (originalTokens <= available) {
    return {
      content: fileContent,
      originalTokens,
      truncatedTokens: originalTokens,
      truncated: false,
      warning: "",
    };
  }

  // 按行截断：保留头 60% 和尾 30% 的行
  const lines = fileContent.split("\n");
  const totalLines = lines.length;

  // 估算每行平均 token 数
  const avgTokensPerLine = originalTokens / totalLines;
  const headLines = Math.floor((totalLines * 0.6 * available) / originalTokens);
  const tailLines = Math.floor((totalLines * 0.3 * available) / originalTokens);

  const head = lines.slice(0, headLines).join("\n");
  const tail = lines.slice(-tailLines).join("\n");

  const truncationMarker = `\n\n/* ===== [截断] 原始文件 ${formatTokens(originalTokens)} tokens，已省略中间 ${totalLines - headLines - tailLines} 行 ===== */\n\n`;

  const truncatedContent = head + truncationMarker + tail;
  const truncatedTokens = countTokens(truncatedContent);

  return {
    content: truncatedContent,
    originalTokens,
    truncatedTokens,
    truncated: true,
    warning: `[长文档处理] ${filePath}: ${formatTokens(originalTokens)} tokens → ${formatTokens(truncatedTokens)} tokens（模型限制: ${formatTokens(contextLimit)}，可用: ${formatTokens(available)}）`,
  };
}
