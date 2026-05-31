import { describe, expect, it } from "vitest";
import { formatTaskResultLine, formatTaskSetHeader } from "./logging.js";

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

describe("formatTaskResultLine", () => {
  it("uses success icon for passed results", () => {
    const line = formatTaskResultLine(true, "sources: auth-flow.md | 4/4 关键点");

    expect(line).toBe("   ✅ 通过 | sources: auth-flow.md | 4/4 关键点");
  });

  it("uses failure icon for failed results", () => {
    const line = formatTaskResultLine(false, "2 轮 | 工具: search_docs | 1/4 关键点");

    expect(line).toBe("   ❌ 未通过 | 2 轮 | 工具: search_docs | 1/4 关键点");
  });
});
