import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CallToolResult } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleListFiles, listFilesInputSchema } from "../src/tools/list-files.js";
import { handleReadFile, readFileInputSchema } from "../src/tools/read-file.js";
import { MAX_TOOL_RESULT_CHARS, textResult } from "../src/tools/result.js";
import { handleSearchCode, searchCodeInputSchema } from "../src/tools/search-code.js";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function getText(result: CallToolResult): string {
  const block = result.content[0];
  if (block?.type !== "text") {
    throw new Error("预期工具返回第一个文本内容块");
  }
  return block.text;
}

describe("只读工具适配器", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "mcp-dev-tools-"));
    mkdirSync(join(projectRoot, "src"));
    writeFileSync(join(projectRoot, "README.md"), "alpha\nbeta\ngamma\n");
    writeFileSync(join(projectRoot, "src/sample.ts"), "export const needle = true;\n");
    writeFileSync(join(projectRoot, ".env"), "TOKEN=secret\n");
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("列出匹配的 TypeScript 文件", async () => {
    const result = await handleListFiles({ dir: "src", pattern: "*.ts" }, projectRoot);

    expect(result.isError).not.toBe(true);
    expect(getText(result)).toContain("sample.ts");
  });

  it("按行读取文本文件", async () => {
    const result = await handleReadFile(
      { path: "README.md", startLine: 1, endLine: 2 },
      projectRoot,
    );

    expect(getText(result)).toBe("1: alpha\n2: beta");
  });

  it("搜索代码并返回文件和行号", async () => {
    const result = await handleSearchCode({ query: "needle", dir: "src" }, projectRoot);

    expect(getText(result)).toContain("src/sample.ts");
    expect(getText(result)).toContain("1: export const needle = true;");
  });

  it("拒绝目录穿越", async () => {
    const result = await handleListFiles({ dir: "../" }, projectRoot);

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain("禁止访问项目目录外的路径");
  });

  it("拒绝读取敏感文件", async () => {
    const result = await handleReadFile({ path: ".env" }, projectRoot);

    expect(result.isError).toBe(true);
    expect(getText(result)).toContain("禁止访问敏感文件");
  });
});

describe("输入 Schema", () => {
  it("拒绝错误类型、空查询和倒置行号", () => {
    expect(listFilesInputSchema.safeParse({ dir: 123 }).success).toBe(false);
    expect(searchCodeInputSchema.safeParse({ query: "" }).success).toBe(false);
    expect(
      readFileInputSchema.safeParse({ path: "README.md", startLine: 5, endLine: 2 }).success,
    ).toBe(false);
  });
});

describe("结果边界", () => {
  it("截断超长工具结果并保留原始长度", () => {
    const original = "x".repeat(MAX_TOOL_RESULT_CHARS + 100);
    const text = getText(textResult(original));

    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS);
    expect(text).toContain(`原始长度 ${original.length} 字符`);
  });

  it("Server 与工具源码不向 stdout 写普通日志", () => {
    const sourceFiles = [
      resolve(PROJECT_DIR, "src/server.ts"),
      ...readdirSync(resolve(PROJECT_DIR, "src/tools")).map((name) =>
        resolve(PROJECT_DIR, "src/tools", name),
      ),
    ];

    for (const sourceFile of sourceFiles) {
      expect(readFileSync(sourceFile, "utf-8")).not.toMatch(/console\.log\s*\(/);
    }
  });
});
