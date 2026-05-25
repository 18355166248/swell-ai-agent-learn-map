import { describe, expect, it } from "vitest";
import { parseCliOptions } from "../cli-options.js";

describe("parseCliOptions", () => {
  it("能解析带问题的 --file", () => {
    expect(parseCliOptions(["--file", "./docs/a.md", "这个字段怎么配置？"])).toEqual({
      mode: "file",
      target: "./docs/a.md",
      question: "这个字段怎么配置？",
    });
  });

  it("能解析带问题的 --dir", () => {
    expect(parseCliOptions(["--dir", "./src/utils", "找出所有工具函数的作用"])).toEqual({
      mode: "dir",
      target: "./src/utils",
      question: "找出所有工具函数的作用",
    });
  });

  it("保留旧的 positional file 兼容行为", () => {
    expect(parseCliOptions(["examples/sample.tsx"])).toEqual({
      mode: "file",
      target: "examples/sample.tsx",
      question: undefined,
    });
  });

  it("禁止同时使用 --file 和 --dir", () => {
    expect(() => parseCliOptions(["--file", "a.ts", "--dir", "src"])).toThrow(
      "--file 和 --dir 不能同时使用",
    );
  });
});
