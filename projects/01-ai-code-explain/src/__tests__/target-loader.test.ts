import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectDirectoryFiles } from "../target-loader.js";

describe("collectDirectoryFiles", () => {
  it("会递归收集支持的文件，并生成相对路径", () => {
    const root = join(tmpdir(), `ai-code-explain-${Date.now()}`);
    mkdirSync(join(root, "nested"), { recursive: true });
    writeFileSync(join(root, "index.ts"), "export const a = 1;\n");
    writeFileSync(join(root, "nested", "helper.md"), "# helper\n");

    const result = collectDirectoryFiles(root);

    expect(result.map((item) => item.relativePath)).toEqual(["index.ts", "nested/helper.md"]);
  });

  it("会跳过 node_modules 和隐藏路径", () => {
    const root = join(tmpdir(), `ai-code-explain-${Date.now()}-skip`);
    mkdirSync(join(root, "node_modules"), { recursive: true });
    mkdirSync(join(root, ".cache"), { recursive: true });
    writeFileSync(join(root, "node_modules", "ignored.ts"), "ignored");
    writeFileSync(join(root, ".cache", "hidden.ts"), "hidden");
    writeFileSync(join(root, "keep.ts"), "export const keep = true;");

    const result = collectDirectoryFiles(root);

    expect(result.map((item) => item.relativePath)).toEqual(["keep.ts"]);
  });

  it("当没有可分析文件时抛错", () => {
    const root = join(tmpdir(), `ai-code-explain-${Date.now()}-empty`);
    mkdirSync(root, { recursive: true });

    expect(() => collectDirectoryFiles(root)).toThrow("目录中没有可分析的文件");
  });
});
