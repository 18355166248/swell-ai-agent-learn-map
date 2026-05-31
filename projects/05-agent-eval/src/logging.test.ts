import { describe, expect, it } from "vitest";
import { formatTaskSetHeader } from "./logging.js";

describe("formatTaskSetHeader", () => {
  it("includes task set name, round, and model", () => {
    const header = formatTaskSetHeader({
      name: "agent-eval-round-01",
      description: "Agent 回归任务集",
      taskCount: 5,
      round: 3,
      model: "claude-3-5-sonnet",
    });

    expect(header).toContain("agent-eval-round-01");
    expect(header).toContain("Agent 回归任务集");
    expect(header).toContain("任务数: 5");
    expect(header).toContain("轮次: 3");
    expect(header).toContain("模型: claude-3-5-sonnet");
  });
});
