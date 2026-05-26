import { describe, it, expect } from "vitest";
import { countTokens, estimateTokens, getContextLimit, formatTokens } from "../token-counter.js";

describe("countTokens", () => {
  it("counts tokens for plain English text", () => {
    const tokens = countTokens("Hello world, this is a test.");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("counts tokens for Chinese text", () => {
    const tokens = countTokens("这是一段中文测试文本");
    expect(tokens).toBeGreaterThan(0);
  });

  it("counts tokens for empty string as 0", () => {
    const tokens = countTokens("");
    expect(tokens).toBe(0);
  });

  it("returns consistent results for repeated calls", () => {
    const text = "function hello() { return 42; }";
    const a = countTokens(text);
    const b = countTokens(text);
    expect(a).toBe(b);
  });
});

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates Chinese text reasonably", () => {
    const result = estimateTokens("你好世界");
    // 4 Chinese chars ≈ 4 tokens
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(6);
  });

  it("estimates English text reasonably", () => {
    const result = estimateTokens("Hello world test");
    // ~15 chars / 3.5 ≈ 5 tokens
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(8);
  });
});

describe("getContextLimit", () => {
  it("returns limit for known model", () => {
    expect(getContextLimit("openai/gpt-oss-120b:free")).toBe(128_000);
    expect(getContextLimit("qwen/qwen3-coder:free")).toBe(1_000_000);
  });

  it("returns default for unknown model", () => {
    expect(getContextLimit("unknown-model")).toBe(128_000);
  });

  it("returns default for undefined", () => {
    expect(getContextLimit()).toBe(128_000);
  });
});

describe("formatTokens", () => {
  it("formats thousands with K", () => {
    expect(formatTokens(8_000)).toBe("8.0K");
  });

  it("formats millions with M", () => {
    expect(formatTokens(1_500_000)).toBe("1.5M");
  });

  it("formats small numbers as-is", () => {
    expect(formatTokens(500)).toBe("500");
  });
});
