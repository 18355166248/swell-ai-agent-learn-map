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

describe("listFiles pattern filtering", () => {
  it("matches nested files using a path-aware glob", async () => {
    const { projectRoot } = createFixture();

    const result = await listFiles({ pattern: "src/**/*.ts" }, projectRoot);

    expect(result).toContain("src/demo.ts");
  });
});
