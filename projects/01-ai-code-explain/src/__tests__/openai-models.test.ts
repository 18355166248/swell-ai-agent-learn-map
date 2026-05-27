import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENAI_MODEL,
  isSupportedOpenAIModel,
  resolveOpenAIModel,
} from "../openai-models.js";

describe("isSupportedOpenAIModel", () => {
  it("accepts supported OpenRouter free models", () => {
    expect(isSupportedOpenAIModel("openai/gpt-oss-120b:free")).toBe(true);
    expect(isSupportedOpenAIModel("qwen/qwen3-coder:free")).toBe(true);
  });

  it("rejects unsupported or foreign models", () => {
    expect(isSupportedOpenAIModel("official-deepseek-v4-pro")).toBe(false);
    expect(isSupportedOpenAIModel("")).toBe(false);
    expect(isSupportedOpenAIModel(undefined)).toBe(false);
  });
});

describe("resolveOpenAIModel", () => {
  it("keeps supported models unchanged", () => {
    expect(resolveOpenAIModel("deepseek/deepseek-v4-flash:free")).toEqual({
      modelName: "deepseek/deepseek-v4-flash:free",
    });
  });

  it("uses the default model when no model is configured", () => {
    expect(resolveOpenAIModel(undefined)).toEqual({
      modelName: DEFAULT_OPENAI_MODEL,
    });
  });

  it("falls back and warns when a non-OpenRouter model leaks in", () => {
    const result = resolveOpenAIModel("official-deepseek-v4-pro");
    expect(result.modelName).toBe(DEFAULT_OPENAI_MODEL);
    expect(result.warning).toContain("official-deepseek-v4-pro");
  });
});
