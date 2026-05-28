import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

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

describe("runAgent", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("reports loop iterations instead of tool step count", async () => {
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
});
