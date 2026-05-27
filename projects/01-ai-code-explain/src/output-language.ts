export type OutputLanguage = "zh-CN" | "en";

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/** 根据用户问题推断结果语言；当前优先覆盖中文/英文，未命中时默认中文。 */
export function resolveOutputLanguage(question?: string): OutputLanguage {
  if (!question || !question.trim()) {
    return "zh-CN";
  }

  const chineseChars = countMatches(question, /[\u4e00-\u9fff]/g);
  const englishWords = countMatches(question, /[A-Za-z]+/g);

  if (englishWords > 0 && chineseChars === 0) {
    return "en";
  }

  return "zh-CN";
}

export function getLanguageInstruction(language: OutputLanguage): string {
  return language === "en"
    ? "summary、dependencies、components、risks 的内容必须使用英文。"
    : "summary、dependencies、components、risks 的内容必须使用中文。";
}

/**
 * 检测文本的实际语言。统计中文字符 vs 英文单词数，多数决定。
 * 中文 > 英文 → "zh-CN"，否则 → "en"。
 * 文本为空时返回 null，表示无法判断。
 */
export function detectTextLanguage(text: string): OutputLanguage | null {
  if (!text || !text.trim()) {
    return null;
  }

  const chineseChars = countMatches(text, /[一-鿿]/g);
  const englishWords = countMatches(text, /[A-Za-z]+/g);

  // 两者都为 0 时（纯符号/数字）无法判断
  if (chineseChars === 0 && englishWords === 0) {
    return null;
  }

  return chineseChars >= englishWords ? "zh-CN" : "en";
}

/**
 * 校验结果语言是否匹配目标语言。
 * 仅在结果有足够文本内容时才判断；空结果或纯符号视为通过。
 */
export function isLanguageMatch(actual: OutputLanguage | null, expected: OutputLanguage): boolean {
  if (actual === null) {
    return true; // 无法判断时放行，避免误伤
  }
  return actual === expected;
}

/** 结果对象的最小形态（两个 analyzer 共用，避免循环依赖） */
export interface LanguageCheckResult {
  summary: string;
  dependencies: string[];
  components: string[];
  risks: string[];
}

/**
 * 检测结果的 summary 字段语言。
 * 注意：dependencies/components/risks 里是代码标识符（如 useUserInfo、BannerSwiper），
 * 这些天然是英文形式，无论输出语言如何都不应参与统计，否则会误判中文结果为英文。
 */
export function detectResultLanguage(result: LanguageCheckResult): OutputLanguage | null {
  return detectTextLanguage(result.summary);
}
