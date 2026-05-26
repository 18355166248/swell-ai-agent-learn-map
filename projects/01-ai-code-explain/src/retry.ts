/** 重试配置 */
export interface RetryConfig {
  /** 最大重试次数（不含首次调用） */
  maxRetries?: number;
  /** 初始等待毫秒数 */
  baseDelayMs?: number;
  /** 是否打印重试日志到 stderr */
  verbose?: boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  verbose: true,
};

/** 判断错误是否可重试 */
export function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);

  // 不重试的错误类型
  if (
    message.includes("401") || // 认证失败
    message.includes("402") || // 付费/额度
    message.includes("403")    // 权限拒绝
  ) {
    return false;
  }

  // 可重试的错误模式
  if (
    message.includes("429") ||          // rate limit
    message.includes("500") ||          // 服务端错误
    message.includes("502") ||          // bad gateway
    message.includes("503") ||          // 服务不可用
    message.includes("timeout") ||      // 超时
    message.includes("ETIMEDOUT") ||    // 网络超时
    message.includes("ECONNRESET") ||   // 连接重置
    message.includes("network") ||      // 网络错误
    message.includes("rate") ||         // 限流变体
    message.includes("overloaded")      // 服务过载
  ) {
    return true;
  }

  // Anthropic SDK 特定错误
  if (
    message.includes("overloaded_error") ||
    message.includes("rate_limit_error")
  ) {
    return true;
  }

  return false;
}

/**
 * 计算指数退避延时（毫秒）：baseDelay * 2^attempt，加上 ±25% 随机抖动。
 * 返回延时毫秒数，不直接执行等待。
 */
function calcBackoffMs(attempt: number, baseDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const jitter = exponential * 0.25 * (Math.random() * 2 - 1);
  return Math.round(exponential + jitter);
}

/**
 * 为异步调用添加重试能力。
 * 只对可重试错误做指数退避重试；不可重试的错误立即抛出。
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  config: RetryConfig = {},
): Promise<T> {
  const { maxRetries, baseDelayMs, verbose } = { ...DEFAULT_CONFIG, ...config };

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= maxRetries || !isRetryableError(err)) {
        throw err;
      }

      const message = err instanceof Error ? err.message : String(err);
      const delayMs = calcBackoffMs(attempt, baseDelayMs);
      if (verbose) {
        process.stderr.write(
          `[重试] ${context}: 第 ${attempt + 1}/${maxRetries} 次重试 (${delayMs}ms)，原因: ${message.slice(0, 120)}\n`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
