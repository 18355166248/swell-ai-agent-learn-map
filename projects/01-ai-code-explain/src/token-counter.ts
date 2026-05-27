import { encoding_for_model, get_encoding } from "tiktoken";

/** 已知模型的上下文窗口大小（token 数） */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "official-deepseek-v4-pro": 128_000,
  "openai/gpt-oss-120b:free": 128_000,
  "openai/gpt-oss-20b:free": 128_000,
  "qwen/qwen3-coder:free": 262_000,
  "deepseek/deepseek-v4-flash:free": 1_000_000,
  "meta-llama/llama-3.3-70b-instruct:free": 128_000,
  "nvidia/nemotron-3-super-120b-a12b:free": 128_000,
};

let _encoder: ReturnType<typeof encoding_for_model> | null = null;

function getEncoder() {
  if (!_encoder) {
    try {
      _encoder = encoding_for_model("gpt-4o");
    } catch {
      _encoder = get_encoding("cl100k_base");
    }
  }
  return _encoder;
}

/** 使用 tiktoken 精确计算 token 数，失败时回退到字符估算 */
export function countTokens(text: string): number {
  try {
    return getEncoder().encode(text).length;
  } catch {
    return estimateTokens(text);
  }
}

/** 简单字符估算：中文约 1 token/字，英文约 1 token/4 字符，混合取 1 token/3 字符 */
export function estimateTokens(text: string): number {
  let chineseChars = 0;
  let otherChars = 0;

  for (const ch of text) {
    if (/[一-鿿　-〿＀-￯]/.test(ch)) {
      chineseChars++;
    } else {
      otherChars++;
    }
  }

  return Math.ceil(chineseChars + otherChars / 3.5);
}

/** 获取指定模型的上下文窗口大小，未知模型返回保守默认值 */
export function getContextLimit(modelName?: string): number {
  if (modelName && MODEL_CONTEXT_LIMITS[modelName]) {
    return MODEL_CONTEXT_LIMITS[modelName];
  }
  // 查找部分匹配
  if (modelName) {
    for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
      if (modelName.includes(key) || key.includes(modelName)) {
        return limit;
      }
    }
  }
  return 128_000; // 保守默认
}

/** 格式化 token 数为可读字符串 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}
