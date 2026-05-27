import { describe, expect, it } from "vitest";
import { resolveAnthropicBaseURL } from "../analyzer.js";

describe("resolveAnthropicBaseURL", () => {
  it("reads ANTHROPIC_BASE_URL directly", () => {
    expect(
      resolveAnthropicBaseURL({
        ANTHROPIC_BASE_URL: "http://anthropic-gateway/api/v1",
      } as NodeJS.ProcessEnv),
    ).toBe("http://anthropic-gateway/api/v1");
  });

  it("returns undefined when neither variable is set", () => {
    expect(resolveAnthropicBaseURL({} as NodeJS.ProcessEnv)).toBeUndefined();
  });
});
