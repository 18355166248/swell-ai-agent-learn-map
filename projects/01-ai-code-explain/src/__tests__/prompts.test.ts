import { describe, it, expect } from "vitest";
import { buildUserPrompt, SYSTEM_PROMPT } from "../prompts.js";

describe("buildUserPrompt", () => {
  it("应包含文件路径", () => {
    const result = buildUserPrompt({
      filePath: "/test/App.tsx",
      fileContent: "",
    });
    expect(result).toContain("/test/App.tsx");
  });

  it("应包含文件内容", () => {
    const result = buildUserPrompt({
      filePath: "a.ts",
      fileContent: "console.log(1)",
    });
    expect(result).toContain("console.log(1)");
  });

  it("应包含预期输出字段名", () => {
    const result = buildUserPrompt({ filePath: "x.ts", fileContent: "//" });
    expect(result).toContain("summary");
    expect(result).toContain("dependencies");
    expect(result).toContain("components");
    expect(result).toContain("risks");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("应要求返回 JSON", () => {
    expect(SYSTEM_PROMPT).toContain("JSON");
  });

  it("应包含空数组 [] 说明", () => {
    expect(SYSTEM_PROMPT).toContain("[]");
  });
});
