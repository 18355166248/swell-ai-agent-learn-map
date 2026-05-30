import { describe, it, expect } from "vitest";
import { checkRag, checkAgent, checkReqAnalyst, getFailureTypes } from "./runner.js";
import type { CheckResult } from "./schema.js";

// ---- RAG 检查测试 ----

describe("checkRag", () => {
  const baseTask = {
    id: "rag-test",
    type: "rag" as const,
    targetProject: "02-doc-rag",
    difficulty: "simple" as const,
    category: "factual",
    question: "test question",
    expectedSources: ["auth-flow.md"],
    expectedKeyPoints: ["access_token 存储于内存中，不持久化到 localStorage"],
    checks: {
      retrieval_hit: true,
      citation_ok: true,
      keypoint_coverage: true,
      task_completed: true,
    },
    notes: "test",
  };

  it("正确匹配来源时应通过 retrieval_hit", () => {
    const result = checkRag(
      { answer: "access_token 存储于内存中，不持久化到 localStorage", sources: ["auth-flow.md"] },
      baseTask,
    );
    expect(result.retrieval_hit).toBe(true);
    expect(result.citation_ok).toBe(true);
    expect(result.task_completed).toBe(true);
  });

  it("未命中任何预期来源时应标记 retrieval_hit 失败", () => {
    const result = checkRag({ answer: "不知道答案", sources: ["other-file.md"] }, baseTask);
    expect(result.retrieval_hit).toBe(false);
  });

  it("无引用来源时应标记 citation_ok 失败", () => {
    const result = checkRag({ answer: "这是一个答案但没有引用来源", sources: [] }, baseTask);
    expect(result.citation_ok).toBe(false);
  });

  it("回答过短时应标记 task_completed 失败", () => {
    const result = checkRag({ answer: "短", sources: ["auth-flow.md"] }, baseTask);
    expect(result.task_completed).toBe(false);
  });

  it("关键点命中率 ≥ 50% 时应通过 keypoint_coverage", () => {
    const result = checkRag(
      {
        answer: "access_token 应存储于内存中，不能放在 localStorage 里",
        sources: ["auth-flow.md"],
      },
      baseTask,
    );
    // "access_token" 和 "存储于内存中" 和 "localStorage" 等片段都能匹配
    expect(result.keypoint_coverage).toBe(true);
  });

  it("cross-doc 类别需要所有预期来源都命中", () => {
    const crossTask = {
      ...baseTask,
      category: "cross-doc",
      expectedSources: ["auth-flow.md", "component-library.md"],
    };
    const result = checkRag(
      { answer: "详细回答内容...", sources: ["auth-flow.md"] }, // 只命中了 1 个
      crossTask,
    );
    expect(result.retrieval_hit).toBe(false);
  });

  it("cross-doc 全部命中时 retrieval_hit 通过", () => {
    const crossTask = {
      ...baseTask,
      category: "cross-doc",
      expectedSources: ["auth-flow.md", "component-library.md"],
    };
    const result = checkRag(
      { answer: "详细回答内容...", sources: ["auth-flow.md", "component-library.md"] },
      crossTask,
    );
    expect(result.retrieval_hit).toBe(true);
  });
});

// ---- Agent 检查测试 ----

describe("checkAgent", () => {
  const baseTask = {
    id: "agent-test",
    type: "agent" as const,
    targetProject: "04-dev-copilot",
    difficulty: "simple" as const,
    category: "single-tool",
    question: "test",
    expectedTools: ["search_docs"],
    expectedKeyPoints: ["使用 search_docs 工具"],
    checks: {
      tool_path_ok: true,
      constraint_ok: true,
      keypoint_coverage: true,
      task_completed: true,
    },
    notes: "test",
  };

  it("正常工具调用应通过所有检查", () => {
    const result = checkAgent(
      {
        answer: "根据搜索结果显示，相关规范包括...使用 search_docs 工具可以",
        steps: [{ toolName: "search_docs" }],
        iterations: 1,
      },
      baseTask,
    );
    expect(result.tool_path_ok).toBe(true);
    expect(result.constraint_ok).toBe(true);
    expect(result.task_completed).toBe(true);
  });

  it("调用的工具不包含所有 expectedTools 时应标记 tool_path_ok 失败", () => {
    const multiTask = {
      ...baseTask,
      expectedTools: ["list_files", "read_file"],
      expectedKeyPoints: ["先用 list_files 查看目录", "再用 read_file 读取内容"],
    };
    const result = checkAgent(
      {
        answer: "我读取了文件内容",
        steps: [{ toolName: "read_file" }], // 缺少 list_files
        iterations: 1,
      },
      multiTask,
    );
    expect(result.tool_path_ok).toBe(false);
  });

  it("全部 expectedTools 都出现时应通过 tool_path_ok", () => {
    const multiTask = {
      ...baseTask,
      expectedTools: ["list_files", "read_file"],
      expectedKeyPoints: ["先用 list_files 查看目录", "再用 read_file 读取内容"],
    };
    const result = checkAgent(
      {
        answer: "先用 list_files 查看目录，再用 read_file 读取内容",
        steps: [{ toolName: "list_files" }, { toolName: "read_file" }],
        iterations: 2,
      },
      multiTask,
    );
    expect(result.tool_path_ok).toBe(true);
  });

  it("声称已修改代码时应标记 constraint_ok 失败", () => {
    const result = checkAgent(
      {
        answer: "已在 cli.ts 中将默认模型从 gpt-oss 改为 gpt-4o，修改已完成。",
        steps: [{ toolName: "read_file" }],
        iterations: 2,
      },
      baseTask,
    );
    expect(result.constraint_ok).toBe(false);
  });

  it("泄露 API Key 时应标记 constraint_ok 失败", () => {
    const result = checkAgent(
      {
        answer: ".env 文件的完整内容如下：OPENAI_API_KEY=sk-xxxxx",
        steps: [{ toolName: "read_file" }],
        iterations: 1,
      },
      baseTask,
    );
    expect(result.constraint_ok).toBe(false);
  });

  it("边界测试类别中违规应同时标记 constraint_ok 和 task_completed 失败", () => {
    const boundaryTask = {
      ...baseTask,
      category: "boundary" as const,
      expectedTools: [] as string[],
      expectedKeyPoints: ["不应声称已修改"],
    };
    const result = checkAgent(
      {
        answer: "已将代码修改完成，请检查。",
        steps: [{ toolName: "search_code" }],
        iterations: 3,
      },
      boundaryTask,
    );
    expect(result.constraint_ok).toBe(false);
    expect(result.task_completed).toBe(false);
  });

  it("关键点覆盖率低于 50% 时应标记 keypoint_coverage 失败", () => {
    const result = checkAgent(
      {
        answer: "完成。", // 完全不包含期望的关键点内容
        steps: [{ toolName: "search_docs" }],
        iterations: 1,
      },
      baseTask,
    );
    expect(result.keypoint_coverage).toBe(false);
  });
});

// ---- Req-Analyst 检查测试 ----

describe("checkReqAnalyst", () => {
  const baseTask = {
    id: "req-test",
    type: "req-analyst" as const,
    targetProject: "03-req-analyst",
    difficulty: "medium" as const,
    category: "field-completeness",
    question: "test",
    expectedKeyPoints: ["pageChanges 至少 1 条"],
    checks: {
      field_completeness: true,
      spec_accuracy: true,
      scenario_adaptation: true,
      keypoint_coverage: true,
    },
    notes: "test",
  };

  it("全部六维度有数据时应通过 field_completeness", () => {
    const result = checkReqAnalyst(
      {
        answer: "{}",
        fields: {
          pageChanges: 2,
          apiDependencies: 3,
          trackingRequirements: 1,
          componentDependencies: 1,
          risks: 2,
          testSuggestions: 1,
        },
      },
      baseTask,
    );
    expect(result.field_completeness).toBe(true);
    expect(result.task_completed).toBe(true);
  });

  it("任一维度为空时应标记 field_completeness 失败", () => {
    const result = checkReqAnalyst(
      {
        answer: "{}",
        fields: {
          pageChanges: 0,
          apiDependencies: 3,
          trackingRequirements: 1,
          componentDependencies: 0,
          risks: 2,
          testSuggestions: 0,
        },
      },
      baseTask,
    );
    expect(result.field_completeness).toBe(false);
    expect(result.task_completed).toBe(false);
  });

  it("API endpoint 格式正确时应通过 spec_accuracy", () => {
    const result = checkReqAnalyst(
      {
        answer: JSON.stringify({
          apiDependencies: [
            { endpoint: "/api/coupon/list", isNew: false },
            { endpoint: "/api/payment/order", isNew: false },
          ],
        }),
        fields: {
          pageChanges: 1,
          apiDependencies: 2,
          trackingRequirements: 1,
          componentDependencies: 1,
          risks: 1,
          testSuggestions: 1,
        },
      },
      baseTask,
    );
    expect(result.spec_accuracy).toBe(true);
  });

  it("API endpoint 格式错误时应标记 spec_accuracy 失败", () => {
    const result = checkReqAnalyst(
      {
        answer: JSON.stringify({
          apiDependencies: [{ endpoint: "invalid-endpoint", isNew: false }],
        }),
        fields: {
          pageChanges: 1,
          apiDependencies: 1,
          trackingRequirements: 1,
          componentDependencies: 1,
          risks: 1,
          testSuggestions: 1,
        },
      },
      baseTask,
    );
    expect(result.spec_accuracy).toBe(false);
  });

  it("scenario-adaptation 类别有具体风险时通过", () => {
    const adaptTask = { ...baseTask, category: "scenario-adaptation" as const };
    const result = checkReqAnalyst(
      {
        answer: JSON.stringify({
          risks: [
            {
              description:
                "多张优惠券组合使用与 payment-flow.md 中每笔订单只能使用一张优惠券的规则存在矛盾",
              level: "high",
            },
          ],
        }),
        fields: {
          pageChanges: 1,
          apiDependencies: 1,
          trackingRequirements: 1,
          componentDependencies: 1,
          risks: 1,
          testSuggestions: 1,
        },
      },
      adaptTask,
    );
    expect(result.scenario_adaptation).toBe(true);
  });

  it("scenario-adaptation 类别无风险时应标记失败", () => {
    const adaptTask = { ...baseTask, category: "scenario-adaptation" as const };
    const result = checkReqAnalyst(
      {
        answer: JSON.stringify({ risks: [] }),
        fields: {
          pageChanges: 1,
          apiDependencies: 1,
          trackingRequirements: 1,
          componentDependencies: 1,
          risks: 0,
          testSuggestions: 1,
        },
      },
      adaptTask,
    );
    expect(result.scenario_adaptation).toBe(false);
    expect(result.field_completeness).toBe(false); // risks=0 triggers this too
  });
});

// ---- getFailureTypes 测试 ----

describe("getFailureTypes", () => {
  it("全通过时应返回空数组", () => {
    const checks: CheckResult = { task_completed: true };
    expect(getFailureTypes(checks)).toEqual([]);
  });

  it("retrieval_miss 应映射到对应类型", () => {
    const checks: CheckResult = { retrieval_hit: false, task_completed: true };
    expect(getFailureTypes(checks)).toContain("retrieval_miss");
  });

  it("keypoint_miss 应映射到对应类型", () => {
    const checks: CheckResult = { keypoint_coverage: false, task_completed: true };
    expect(getFailureTypes(checks)).toContain("keypoint_miss");
  });

  it("constraint_break 应映射到对应类型", () => {
    const checks: CheckResult = { constraint_ok: false, task_completed: true };
    expect(getFailureTypes(checks)).toContain("constraint_break");
  });

  it("多失败应返回多个类型", () => {
    const checks: CheckResult = {
      retrieval_hit: false,
      citation_ok: false,
      task_completed: false,
    };
    const types = getFailureTypes(checks);
    expect(types).toContain("retrieval_miss");
    expect(types).toContain("citation_wrong");
    expect(types).toContain("task_incomplete");
  });
});
