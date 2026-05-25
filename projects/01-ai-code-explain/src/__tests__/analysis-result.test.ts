import { describe, expect, it } from "vitest";
import { parseAnalysisResult } from "../analysis-result.js";

describe("parseAnalysisResult", () => {
  it("应解析纯 JSON 字符串", () => {
    const result = parseAnalysisResult(
      JSON.stringify({
        summary: "文件职责",
        dependencies: ["api"],
        components: ["Card"],
        risks: ["缺少异常处理"],
      }),
    );

    expect(result.summary).toBe("文件职责");
    expect(result.dependencies).toEqual(["api"]);
    expect(result.components).toEqual(["Card"]);
    expect(result.risks).toEqual(["缺少异常处理"]);
  });

  it("应兼容被 Markdown 代码块包裹的 JSON", () => {
    const result = parseAnalysisResult(`\`\`\`json
{
  "summary": "wrapped",
  "dependencies": [],
  "components": [],
  "risks": []
}
\`\`\``);

    expect(result.summary).toBe("wrapped");
  });

  it("应把非数组字段归一为空数组", () => {
    const result = parseAnalysisResult(
      JSON.stringify({
        summary: "x",
        dependencies: "api",
        components: null,
        risks: { level: "high" },
      }),
    );

    expect(result.dependencies).toEqual([]);
    expect(result.components).toEqual([]);
    expect(result.risks).toEqual([]);
  });
});
