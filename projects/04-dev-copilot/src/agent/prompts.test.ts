import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./prompts.js";

describe("SYSTEM_PROMPT", () => {
  it("guides tool inventory questions to use list_files and read_file before keyword search", () => {
    expect(SYSTEM_PROMPT).toContain("如果用户要盘点项目里的工具、函数、模块或能力清单");
    expect(SYSTEM_PROMPT).toContain("先用 list_files 找目录或候选文件");
    expect(SYSTEM_PROMPT).toContain("再用 read_file 读取 registry");
    expect(SYSTEM_PROMPT).toContain("不要一开始连续使用 search_code 盲搜");
  });

  it("forbids using search_docs as the main path for code tool inventory questions", () => {
    expect(SYSTEM_PROMPT).toContain("这类问题的主路径是代码目录和注册表");
    expect(SYSTEM_PROMPT).toContain("不是 search_docs");
    expect(SYSTEM_PROMPT).toContain("必须优先读取 src/agent/tools/registry.ts");
  });

  it("requires doc answers to carry explicit source markers on the final conclusion", () => {
    expect(SYSTEM_PROMPT).toContain("如果答案来自 search_docs");
    expect(SYSTEM_PROMPT).toContain("最终答案中显式写出来源文件名");
    expect(SYSTEM_PROMPT).toContain("每组关键要点后补充来源标注");
  });
});
