import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readFile } from "./readFile.js";
import { listFiles } from "./listFiles.js";
import { searchCode } from "./searchCode.js";
import { grep } from "./grep.js";

function createFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), "dev-copilot-tools-"));
  const siblingRoot = `${projectRoot}-sibling`;

  mkdirSync(join(projectRoot, "src"), { recursive: true });
  mkdirSync(siblingRoot, { recursive: true });

  writeFileSync(join(projectRoot, "src", "demo.ts"), "export const value = 42;\n");
  writeFileSync(join(siblingRoot, "secret.ts"), "export const secret = true;\n");

  return { projectRoot, siblingRoot };
}

describe("tool path safety", () => {
  it("rejects sibling paths for readFile", async () => {
    const { projectRoot, siblingRoot } = createFixture();

    await expect(readFile({ path: join(siblingRoot, "secret.ts") }, projectRoot)).rejects.toThrow(
      /禁止访问项目目录外的路径/,
    );
  });

  it("rejects sibling paths for listFiles/searchCode/grep", async () => {
    const { projectRoot, siblingRoot } = createFixture();

    await expect(listFiles({ dir: siblingRoot }, projectRoot)).rejects.toThrow(
      /禁止访问项目目录外的路径/,
    );
    await expect(searchCode({ query: "secret", dir: siblingRoot }, projectRoot)).rejects.toThrow(
      /禁止访问项目目录外的路径/,
    );
    await expect(grep({ pattern: "secret", dir: siblingRoot }, projectRoot)).rejects.toThrow(
      /禁止访问项目目录外的路径/,
    );
  });
});

describe("readFile line-range for large files", () => {
  it("reads specified lines from a file larger than 100KB", async () => {
    const { projectRoot } = createFixture();

    // 创建一个 >100KB 的文件（每行约 60 字节，写 2000 行 ≈ 120KB）
    const lines: string[] = [];
    for (let i = 1; i <= 2000; i++) {
      lines.push(`[${String(i).padStart(4, "0")}] ${"x".repeat(50)}`);
    }
    writeFileSync(join(projectRoot, "large.ts"), lines.join("\n"), "utf-8");

    // 指定行范围时应该能正常读取
    const result = await readFile({ path: "large.ts", startLine: 10, endLine: 12 }, projectRoot);

    expect(result).toContain("[0010]");
    expect(result).toContain("[0011]");
    expect(result).toContain("[0012]");
    // 不应包含超出范围的行
    expect(result).not.toContain("[0013]");
    expect(result).not.toContain("[0009]");
  });

  it("rejects large file when no line range is specified", async () => {
    const { projectRoot } = createFixture();

    const lines: string[] = [];
    for (let i = 1; i <= 2000; i++) {
      lines.push(`[${String(i).padStart(4, "0")}] ${"x".repeat(50)}`);
    }
    writeFileSync(join(projectRoot, "large.ts"), lines.join("\n"), "utf-8");

    const result = await readFile({ path: "large.ts" }, projectRoot);

    expect(result).toContain("文件过大");
    expect(result).toContain("startLine/endLine");
  });

  it("rejects large file when only startLine is given without endLine", async () => {
    const { projectRoot } = createFixture();

    const lines: string[] = [];
    for (let i = 1; i <= 2000; i++) {
      lines.push(`[${String(i).padStart(4, "0")}] ${"x".repeat(50)}`);
    }
    writeFileSync(join(projectRoot, "large.ts"), lines.join("\n"), "utf-8");

    // 仅指定 startLine，无 endLine，大文件应被拒绝
    const result = await readFile({ path: "large.ts", startLine: 1998 }, projectRoot);

    expect(result).toContain("文件过大");
    expect(result).toContain("startLine/endLine");
  });

  it("reads from startLine to end on small files without endLine", async () => {
    const { projectRoot } = createFixture();

    // 小文件（≤100KB）仅指定 startLine 应正常读取到末尾
    const result = await readFile({ path: "src/demo.ts", startLine: 1 }, projectRoot);

    expect(result).toContain("export const value = 42;");
  });

  it("still reads small files fully without line range", async () => {
    const { projectRoot } = createFixture();

    // 小文件（现有 fixture 中的 demo.ts 只有一行）应该能直接读取
    const result = await readFile({ path: "src/demo.ts" }, projectRoot);

    expect(result).toContain("export const value = 42;");
  });
});
describe("listFiles pattern filtering", () => {
  it("matches nested files using a path-aware glob", async () => {
    const { projectRoot } = createFixture();

    const result = await listFiles({ pattern: "src/**/*.ts" }, projectRoot);

    expect(result).toContain("src/demo.ts");
  });
});
