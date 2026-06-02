/** OpenRouter 上当前允许的免费模型列表 */
export const OPENAI_FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3-coder:free",
  "deepseek/deepseek-v4-flash:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
] as const;

export const DEFAULT_OPENAI_MODEL = OPENAI_FREE_MODELS[0];

/** 判断模型名是否属于当前 OpenAI/OpenRouter CLI 支持的列表。 */
export function isSupportedOpenAIModel(modelName?: string): boolean {
  return (
    !!modelName && OPENAI_FREE_MODELS.includes(modelName as (typeof OPENAI_FREE_MODELS)[number])
  );
}

/**
 * 解析 OpenAI CLI 最终使用的模型。
 * 这里显式隔离 Anthropic CLI 的 ANTHROPIC_MODEL_NAME，避免根 .env 里的内部模型串台到 OpenRouter 请求。
 */
export function resolveOpenAIModel(modelName?: string): {
  modelName: string;
  warning?: string;
} {
  if (isSupportedOpenAIModel(modelName)) {
    return { modelName: modelName! };
  }

  if (!modelName) {
    return { modelName: DEFAULT_OPENAI_MODEL };
  }

  return {
    modelName: DEFAULT_OPENAI_MODEL,
    warning:
      `检测到不受支持的 OpenAI CLI 模型 "${modelName}"，` +
      `已自动回退到 ${DEFAULT_OPENAI_MODEL}。` +
      `如需指定模型，请使用 --model 或在 .env.openai 中配置支持的模型名。`,
  };
}
