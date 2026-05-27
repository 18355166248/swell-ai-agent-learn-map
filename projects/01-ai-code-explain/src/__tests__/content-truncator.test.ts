import { describe, it, expect } from "vitest";
import { truncateContent } from "../content-truncator.js";
import { countTokens } from "../token-counter.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "../prompts.js";

describe("truncateContent", () => {
  const smallContent = "export const hello = 'world';\n";
  const filePath = "test/sample.ts";

  it("does not truncate content under token limit", () => {
    const result = truncateContent(smallContent, filePath);
    expect(result.truncated).toBe(false);
    expect(result.content).toBe(smallContent);
    expect(result.warning).toBe("");
  });

  it("returns original and truncated token counts", () => {
    const result = truncateContent(smallContent, filePath);
    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.truncatedTokens).toBe(result.originalTokens);
  });

  it("truncates content exceeding the limit", () => {
    // 生成约 200K tokens 的大文本（需要足够大以超出 128K 限制）
    const line = "const x = 42;\n";
    const largeContent = line.repeat(50_000);

    const result = truncateContent(largeContent, filePath);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeLessThan(largeContent.length);
    expect(result.truncatedTokens).toBeLessThan(result.originalTokens);
    expect(result.warning).toContain("[长文档处理]");
    expect(result.warning).toContain(filePath);
  });

  it("includes truncation marker in truncated content", () => {
    const line = "console.log('test');\n";
    const largeContent = line.repeat(50_000);

    const result = truncateContent(largeContent, filePath);
    expect(result.content).toContain("[截断]");
    expect(result.content).toContain("已省略中间");
  });

  it("preserves beginning and end of file", () => {
    const headerLine = "// HEADER - imports\n";
    const footerLine = "// FOOTER - exports\n";
    const midLine = "const x = 1;\n";
    const content = headerLine + midLine.repeat(50_000) + footerLine;

    const result = truncateContent(content, filePath);
    expect(result.truncated).toBe(true);
    expect(result.content.startsWith(headerLine)).toBe(true);
    expect(result.content.endsWith(footerLine)).toBe(true);
  });

  it("handles very large content with appropriate truncation", () => {
    const line = "const a = 1;\n";
    const n = 50_000; // 约 180K tokens，超出 128K 限制
    const content = line.repeat(n);

    const result = truncateContent(content, filePath);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content).toContain("[截断]");
    expect(result.originalTokens).toBeGreaterThan(result.truncatedTokens);
  });

  it("uses the real prompt budget instead of naked file tokens", () => {
    const line = "export const field = 'value';\n";
    const content = line.repeat(120);
    const question = "解释这个文件";
    const createPrompt = (candidate: string) =>
      buildUserPrompt({ filePath, fileContent: candidate, question });
    const contextLimit = countTokens(SYSTEM_PROMPT) + countTokens(createPrompt(content)) + 30;

    const result = truncateContent(content, filePath, {
      contextLimit,
      systemPrompt: SYSTEM_PROMPT,
      createPrompt,
      maxOutputTokens: 40,
      safetyMargin: 10,
    });

    const finalTotal =
      countTokens(SYSTEM_PROMPT) + countTokens(createPrompt(result.content)) + 40 + 10;

    expect(result.truncated).toBe(true);
    expect(finalTotal).toBeLessThanOrEqual(contextLimit);
  });
});
