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
