import { describe, it, expect } from "vitest";
import { buildDirectorySummaryPrompt, buildUserPrompt, SYSTEM_PROMPT } from "../prompts.js";

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

  it("提供 question 时会附加用户问题", () => {
    const result = buildUserPrompt({
      filePath: "docs/a.md",
      fileContent: "# title",
      question: "这个字段怎么配置？",
    });

    expect(result).toContain("用户问题：");
    expect(result).toContain("这个字段怎么配置？");
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

describe("buildDirectorySummaryPrompt", () => {
  it("能基于逐文件结果构建目录 summary prompt", () => {
    const prompt = buildDirectorySummaryPrompt({
      dirPath: "./src/utils",
      question: "找出所有工具函数的作用",
      files: [
        {
          path: "format.ts",
          result: {
            summary: "处理日期格式",
            dependencies: ["dayjs"],
            components: [],
            risks: [],
          },
        },
      ],
    });

    expect(prompt).toContain("./src/utils");
    expect(prompt).toContain("format.ts");
    expect(prompt).toContain("处理日期格式");
    expect(prompt).toContain("找出所有工具函数的作用");
  });
});
