import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const executeToolMock = vi.fn();
const getToolDefinitionsMock = vi.fn(() => []);

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: createMock,
        },
      };
    },
  };
});

vi.mock("./tools/registry.js", () => {
  return {
    executeTool: executeToolMock,
    getToolDefinitions: getToolDefinitionsMock,
  };
});

describe("runAgent", () => {
  beforeEach(() => {
    createMock.mockReset();
    executeToolMock.mockReset();
    getToolDefinitionsMock.mockClear();
  });

  it("reports loop iterations instead of tool step count", async () => {
    executeToolMock.mockResolvedValue("tool result");
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "先看文件",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "read_file",
                    arguments: JSON.stringify({ path: "README.md" }),
                  },
                },
                {
                  id: "call-2",
                  type: "function",
                  function: {
                    name: "list_files",
                    arguments: JSON.stringify({ dir: "src" }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "最终答案",
            },
          },
        ],
      });

    const { runAgent } = await import("./index.js");
    const result = await runAgent("分析项目", {
      silent: true,
      projectRoot: process.cwd(),
    });

    expect(result.answer).toBe("最终答案");
    expect(result.steps).toHaveLength(3);
    expect(result.iterations).toBe(2);
  });

  it("preloads tool inventory context before the first LLM round for tool catalog questions", async () => {
    executeToolMock.mockResolvedValueOnce("tools dir").mockResolvedValueOnce("registry content");
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "最终答案",
          },
        },
      ],
    });

    const { runAgent } = await import("./index.js");
    const result = await runAgent(
      "这个项目提供了哪些工具函数？请列出每个工具的名称、参数和功能描述。",
      {
        silent: true,
        projectRoot: process.cwd(),
      },
    );

    expect(executeToolMock).toHaveBeenNthCalledWith(
      1,
      "list_files",
      { dir: "projects/04-dev-copilot/src/agent/tools" },
      process.cwd(),
    );
    expect(executeToolMock).toHaveBeenNthCalledWith(
      2,
      "read_file",
      { path: "projects/04-dev-copilot/src/agent/tools/registry.ts", startLine: 1, endLine: 220 },
      process.cwd(),
    );
    expect(result.steps.slice(0, 2).map((step) => step.action?.name)).toEqual([
      "list_files",
      "read_file",
    ]);
    expect(result.answer).toBe("最终答案");
  });

  it("scopes broad code search calls to the tool directory for tool catalog questions", async () => {
    executeToolMock
      .mockResolvedValueOnce("tools dir")
      .mockResolvedValueOnce("registry content")
      .mockResolvedValueOnce("search results");
    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "继续搜索",
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: {
                    name: "search_code",
                    arguments: JSON.stringify({ dir: "", query: "export function" }),
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "最终答案",
            },
          },
        ],
      });

    const { runAgent } = await import("./index.js");
    await runAgent("这个项目提供了哪些工具函数？请列出每个工具的名称、参数和功能描述。", {
      silent: true,
      projectRoot: process.cwd(),
    });

    expect(executeToolMock).toHaveBeenNthCalledWith(
      3,
      "search_code",
      {
        dir: "projects/04-dev-copilot/src/agent/tools",
        query: "export function",
      },
      process.cwd(),
    );
  });
});
