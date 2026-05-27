export interface AnalysisResult {
  summary: string;
  dependencies: string[];
  components: string[];
  risks: string[];
}

function normalizeArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
}

export function parseAnalysisResult(raw: string): AnalysisResult {
  let parsed: AnalysisResult;

  try {
    // 部分模型会把 JSON 包在 Markdown 代码块里，这里统一做一次兜底提取。
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`无法解析模型返回的 JSON:\n${raw.slice(0, 500)}`);
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    dependencies: normalizeArray(parsed.dependencies),
    components: normalizeArray(parsed.components),
    risks: normalizeArray(parsed.risks),
  };
}

/** 判断模型结果是否提供了足够的信息，避免把“全空 JSON”误判为成功。 */
export function hasMeaningfulAnalysisResult(result: AnalysisResult): boolean {
  return (
    result.summary.trim().length > 0 ||
    result.dependencies.length > 0 ||
    result.components.length > 0 ||
    result.risks.length > 0
  );
}
