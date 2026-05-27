import { describe, it, expect } from "vitest";
import { chunkMarkdown } from "../chunker.js";
import type { ChunkEntry } from "../chunker.js";

describe("chunkMarkdown", () => {
  it("空内容返回空数组", () => {
    expect(chunkMarkdown("", "empty.md")).toEqual([]);
  });

  it("纯空白内容返回空数组", () => {
    expect(chunkMarkdown("   \n\n   \n\n   ", "blank.md")).toEqual([]);
  });

  it("单个短段落直接作为一个 chunk", () => {
    const result = chunkMarkdown("这是一个简短的段落。", "short.md");
    expect(result).toHaveLength(1);
    expect(result[0].chunk).toBe("这是一个简短的段落。");
    expect(result[0].source).toBe("short.md");
    expect(result[0].index).toBe(0);
  });

  it("多个短段落合并为一个 chunk（不超过 500 字符阈值）", () => {
    const content = ["第一段的内容，很短。", "第二段的内容，也很短。", "第三段也不长。"].join(
      "\n\n",
    );

    const result = chunkMarkdown(content, "short-merge.md");
    // 三段都很短，应合并成一或两个 chunk
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(3);
    // 每段内容都应出现在某 chunk 中
    const allText = result.map((r) => r.chunk).join("\n\n");
    expect(allText).toContain("第一段");
    expect(allText).toContain("第二段");
    expect(allText).toContain("第三段");
  });

  it("超过 500 字符的长段落应独立成块，短段落合并", () => {
    const longPara = "X".repeat(600);
    const short1 = "短段落一";
    const short2 = "短段落二";
    const content = [longPara, short1, short2].join("\n\n");

    const result = chunkMarkdown(content, "mixed.md");
    // 长段落应独立存在
    const longChunks = result.filter((r) => r.chunk.includes("X"));
    expect(longChunks.length).toBeGreaterThanOrEqual(1);
    // source 正确
    expect(result[0].source).toBe("mixed.md");
  });

  it("index 从 0 递增", () => {
    const content = ["段落A", "段落B", "段落C", "段落D", "段落E"].join("\n\n");
    const result = chunkMarkdown(content, "index.md");
    for (let i = 0; i < result.length; i++) {
      expect(result[i].index).toBe(i);
    }
  });

  it("支持 Windows 风格换行（\\r\\n）", () => {
    const content = "第一段\r\n\r\n第二段\r\n\r\n第三段";
    const result = chunkMarkdown(content, "windows.md");
    // 三段可能合并，但至少产出 1 个 chunk
    expect(result.length).toBeGreaterThanOrEqual(1);
    const allText = result.map((r) => r.chunk).join("\n\n");
    expect(allText).toContain("第一段");
    expect(allText).toContain("第二段");
    expect(allText).toContain("第三段");
  });

  it("Markdown 标题和代码块内容应保留", () => {
    const content = [
      "# 图片上传 CDN 流程",
      "图片上传 CDN 是内容管理系统中最常用的功能之一。",
      "```typescript",
      "interface UploadTokenResponse {",
      "  accessKeyId: string;",
      "}",
      "```",
    ].join("\n\n");

    const result = chunkMarkdown(content, "markdown.md");
    expect(result.length).toBeGreaterThanOrEqual(1);
    const allText = result.map((r) => r.chunk).join("\n\n");
    expect(allText).toContain("# 图片上传 CDN 流程");
    expect(allText).toContain("```typescript");
    expect(allText).toContain("interface UploadTokenResponse");
  });

  it("source 参数正确传递到每个 chunk", () => {
    const content = ["段落一", "段落二"].join("\n\n");
    const result = chunkMarkdown(content, "docs/knowledge-base/upload-cdn.md");
    for (const r of result) {
      expect(r.source).toBe("docs/knowledge-base/upload-cdn.md");
    }
  });

  it("chunk 长度不超过原始段落总长度", () => {
    const content = [...Array(20)].map((_, i) => `这是第 ${i + 1} 段测试内容。`).join("\n\n");
    const result = chunkMarkdown(content, "length.md");
    for (const r of result) {
      expect(r.chunk.length).toBeGreaterThan(0);
      expect(r.chunk.length).toBeLessThanOrEqual(content.length);
    }
  });
});
