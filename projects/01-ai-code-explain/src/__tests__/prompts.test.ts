import { describe, it, expect } from "vitest";
import {
  buildDirectorySummaryPrompt,
  buildDirectorySummaryPromptFromText,
  buildUserPrompt,
  SYSTEM_PROMPT,
} from "../prompts.js";
import { resolveOutputLanguage } from "../output-language.js";

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

  it("根据英文问题要求英文输出", () => {
    const result = buildUserPrompt({
      filePath: "src/a.ts",
      fileContent: "export const a = 1;",
      question: "What does this file do?",
      outputLanguage: "en",
    });

    expect(result).toContain("What does this file do?");
    expect(result).toContain("内容必须使用英文");
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

  it("支持直接传入预格式化的逐文件结果文本", () => {
    const prompt = buildDirectorySummaryPromptFromText(
      "./src/utils",
      '[{"path":"format.ts","result":{"summary":"格式化时间","dependencies":[],"components":[],"risks":[]}}]',
      "概括目录职责",
    );

    expect(prompt).toContain("./src/utils");
    expect(prompt).toContain("format.ts");
    expect(prompt).toContain("概括目录职责");
  });

  it("supports English directory summary output", () => {
    const prompt = buildDirectorySummaryPromptFromText(
      "./src/utils",
      '[{"path":"format.ts","result":{"summary":"formats dates","dependencies":[],"components":[],"risks":[]}}]',
      "Summarize this directory",
      "en",
    );

    expect(prompt).toContain("Summarize this directory");
    expect(prompt).toContain("英文");
  });
});

describe("resolveOutputLanguage", () => {
  it("defaults to Chinese when question is missing", () => {
    expect(resolveOutputLanguage(undefined)).toBe("zh-CN");
  });

  it("returns English for pure English questions", () => {
    expect(resolveOutputLanguage("What does this file do?")).toBe("en");
  });

  it("returns Chinese for Chinese or mixed questions", () => {
    expect(resolveOutputLanguage("这个文件做了什么？")).toBe("zh-CN");
    expect(resolveOutputLanguage("这个 file 做了什么？")).toBe("zh-CN");
  });
});
