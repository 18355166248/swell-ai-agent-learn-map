import { describe, expect, it, vi } from "vitest";
import { runAnalysis } from "../run-analysis.js";

describe("runAnalysis", () => {
  it("会把文件模式结果包成稳定 envelope", async () => {
    const analyzeContent = vi.fn().mockResolvedValue({
      summary: "文档字段说明",
      dependencies: [],
      components: [],
      risks: [],
    });

    const result = await runAnalysis(
      { mode: "file", target: "./docs/a.md", question: "这个字段怎么配置？" },
      {
        readTargetFile: () => "# config",
        collectDirectoryFiles: vi.fn(),
        analyzeContent,
        summarizeDirectory: vi.fn(),
      },
    );

    expect(result).toEqual({
      mode: "file",
      target: "./docs/a.md",
      result: {
        summary: "文档字段说明",
        dependencies: [],
        components: [],
        risks: [],
      },
    });
    expect(analyzeContent).toHaveBeenCalledWith("./docs/a.md", "# config", "这个字段怎么配置？");
  });

  it("会构建包含 summary 和逐文件结果的目录输出", async () => {
    const analyzeContent = vi
      .fn()
      .mockResolvedValueOnce({
        summary: "格式化时间",
        dependencies: ["dayjs"],
        components: [],
        risks: [],
      })
      .mockResolvedValueOnce({
        summary: "拼接 className",
        dependencies: [],
        components: [],
        risks: ["空值输入要注意"],
      });

    const summarizeDirectory = vi.fn().mockResolvedValue("该目录主要提供格式化与样式工具函数。");

    const result = await runAnalysis(
      { mode: "dir", target: "./src/utils", question: "找出所有工具函数的作用" },
      {
        readTargetFile: vi.fn(),
        collectDirectoryFiles: () => [
          {
            absolutePath: "/tmp/format.ts",
            relativePath: "format.ts",
            content: "export const format = () => {}",
          },
          {
            absolutePath: "/tmp/cn.ts",
            relativePath: "cn.ts",
            content: "export const cn = () => {}",
          },
        ],
        analyzeContent,
        summarizeDirectory,
      },
    );

    if (result.mode !== "dir") {
      throw new Error("expected dir mode result");
    }

    expect(result).toEqual({
      mode: "dir",
      target: "./src/utils",
      summary: "该目录主要提供格式化与样式工具函数。",
      files: [
        {
          path: "format.ts",
          result: {
            summary: "格式化时间",
            dependencies: ["dayjs"],
            components: [],
            risks: [],
          },
        },
        {
          path: "cn.ts",
          result: {
            summary: "拼接 className",
            dependencies: [],
            components: [],
            risks: ["空值输入要注意"],
          },
        },
      ],
    });
    expect(summarizeDirectory).toHaveBeenCalledWith(
      "./src/utils",
      result.files,
      "找出所有工具函数的作用",
    );
  });
});
