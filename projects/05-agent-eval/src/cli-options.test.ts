import { describe, expect, it } from "vitest";
import { parseCliOptions } from "./cli-options.js";

describe("parseCliOptions", () => {
  it("defaults to round 1 and all type", () => {
    expect(parseCliOptions([], { ANTHROPIC_MODEL_NAME: "claude-3-5-sonnet" })).toEqual({
      type: "all",
      round: 1,
      model: "claude-3-5-sonnet",
      config: {
        model: "claude-3-5-sonnet",
        temperature: 0.3,
        maxTokens: 2048,
      },
    });
  });

  it("parses explicit eval type, round, and model", () => {
    expect(
      parseCliOptions(["agent", "--round=2", "--model=openai/gpt-4o"], {
        ANTHROPIC_MODEL_NAME: "openai/ignored",
      }),
    ).toEqual({
      type: "agent",
      round: 2,
      model: "openai/gpt-4o",
      config: {
        model: "openai/gpt-4o",
        temperature: 0.3,
        maxTokens: 2048,
      },
    });
  });

  it("falls back to ANTHROPIC_MODEL_NAME when --model is absent", () => {
    expect(
      parseCliOptions(["rag", "--round=3"], { ANTHROPIC_MODEL_NAME: "openai/gpt-4.1" }),
    ).toEqual({
      type: "rag",
      round: 3,
      model: "openai/gpt-4.1",
      config: {
        model: "openai/gpt-4.1",
        temperature: 0.3,
        maxTokens: 2048,
      },
    });
  });

  it("rejects invalid round values", () => {
    expect(() => parseCliOptions(["all", "--round=0"], {})).toThrow(
      "--round 必须是大于等于 1 的整数",
    );
    expect(() => parseCliOptions(["all", "--round=abc"], {})).toThrow(
      "--round 必须是大于等于 1 的整数",
    );
  });

  it("requires ANTHROPIC_MODEL_NAME when --model is absent", () => {
    expect(() => parseCliOptions(["all"], {})).toThrow(
      "缺少模型配置，请通过 --model 传入，或在 .env 中设置 ANTHROPIC_MODEL_NAME",
    );
  });
});
