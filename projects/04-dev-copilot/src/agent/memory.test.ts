import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDataDir = resolve(__dirname, "..", "..", ".data", "conversations");

// 测试前清理，测试后也清理
function cleanDataDir() {
  if (existsSync(testDataDir)) {
    rmSync(testDataDir, { recursive: true, force: true });
  }
}

describe("memory", () => {
  beforeEach(() => {
    cleanDataDir();
    mkdirSync(testDataDir, { recursive: true });
  });

  afterEach(() => {
    cleanDataDir();
  });

  it("creates a new conversation with an id", async () => {
    const { createConversation } = await import("./memory.js");
    const conv = createConversation("分析项目工具函数");
    expect(conv.id).toBeTruthy();
    expect(conv.title).toContain("分析项目工具函数");
    expect(conv.turns).toHaveLength(0);
    expect(conv.createdAt).toBeTruthy();
  });

  it("appends turns to a conversation", async () => {
    const { createConversation, appendTurn, getConversation } = await import("./memory.js");
    const conv = createConversation("第一次问题");
    const updated = appendTurn(conv.id, "第一次问题", "这是回答");
    expect(updated).not.toBeNull();
    expect(updated!.turns).toHaveLength(1);
    expect(updated!.turns[0].task).toBe("第一次问题");
    expect(updated!.turns[0].answer).toBe("这是回答");

    const reloaded = getConversation(conv.id);
    expect(reloaded!.turns).toHaveLength(1);
  });

  it("supports multi-turn conversations", async () => {
    const { createConversation, appendTurn, getConversation } = await import("./memory.js");
    const conv = createConversation("第一轮");

    appendTurn(conv.id, "第一轮：分析工具", "回答1");
    appendTurn(conv.id, "第二轮：继续分析", "回答2");
    appendTurn(conv.id, "第三轮：再看看别的", "回答3");

    const reloaded = getConversation(conv.id);
    expect(reloaded!.turns).toHaveLength(3);
    expect(reloaded!.turns[0].task).toBe("第一轮：分析工具");
    expect(reloaded!.turns[2].task).toBe("第三轮：再看看别的");
  });

  it("lists conversations sorted by updatedAt desc", async () => {
    const { createConversation, appendTurn, listConversations } = await import("./memory.js");
    const a = createConversation("任务 A");
    const b = createConversation("任务 B");

    appendTurn(b.id, "B 的问题", "B 的回答");

    const list = listConversations();
    expect(list).toHaveLength(2);
    // B 最近更新，应该排第一；title 会被首轮 task 更新
    expect(list[0].id).toBe(b.id);
    expect(list[0].title).toContain("B 的问题");
    expect(list[0].turnCount).toBe(1);
  });

  it("formats history context for Agent injection", async () => {
    const { createConversation, appendTurn, getConversation, formatHistoryContext } =
      await import("./memory.js");
    const conv = createConversation("初始问题");

    appendTurn(conv.id, "有哪些工具？", "共5个工具：read_file、list_files...");
    appendTurn(conv.id, "read_file 怎么防目录穿越？", "safePath 通过 resolve + relative 检测..");

    // appendTurn 保存到磁盘，conv 是旧对象，需要用 getConversation 重新加载
    const fresh = getConversation(conv.id)!;
    const ctx = formatHistoryContext(fresh);
    expect(ctx).not.toBeNull();
    expect(ctx!).toContain("对话历史");
    expect(ctx!).toContain("有哪些工具？");
    expect(ctx!).toContain("read_file 怎么防目录穿越？");
    expect(ctx!).toContain("2 轮");
    // 答案应截断到 600 字
    expect(ctx!).toContain("共5个工具");
  });

  it("returns null for empty history", async () => {
    const { createConversation, formatHistoryContext } = await import("./memory.js");
    const conv = createConversation("空会话");
    expect(formatHistoryContext(conv)).toBeNull();
  });

  it("deletes a conversation", async () => {
    const { createConversation, deleteConversation, getConversation } = await import("./memory.js");
    const conv = createConversation("待删除");
    expect(getConversation(conv.id)).not.toBeNull();

    const ok = deleteConversation(conv.id);
    expect(ok).toBe(true);
    expect(getConversation(conv.id)).toBeNull();
  });

  it("returns null for non-existent conversation", async () => {
    const { getConversation, appendTurn } = await import("./memory.js");
    expect(getConversation("nonexistent-id")).toBeNull();
    expect(appendTurn("nonexistent-id", "q", "a")).toBeNull();
  });
});
