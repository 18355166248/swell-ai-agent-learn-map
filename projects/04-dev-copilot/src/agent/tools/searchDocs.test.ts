import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockStatSync, mockReadFileSync, mockSearchRelevantChunks } = vi.hoisted(() => ({
  mockStatSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockSearchRelevantChunks: vi.fn(),
}));

vi.mock("fs", () => ({
  statSync: mockStatSync,
  readFileSync: mockReadFileSync,
}));

vi.mock("doc-rag", () => ({
  searchRelevantChunks: mockSearchRelevantChunks,
}));

import { searchDocs, _resetCache } from "./searchDocs.js";

beforeEach(() => {
  _resetCache();
  vi.clearAllMocks();
});

function statFound(mtimeMs = 1000) {
  return { mtimeMs };
}

function statNotFound() {
  throw Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" });
}

describe("searchDocs vector loading", () => {
  it("returns guidance when no index files exist", async () => {
    mockStatSync.mockImplementation(() => statNotFound());

    const result = await searchDocs({ query: "test" }, "/fake/root");

    expect(result).toContain("文档索引尚未建立");
  });

  it("loads vectors and delegates to searchRelevantChunks", async () => {
    mockStatSync.mockImplementation((p: string) =>
      p.endsWith("vectors.json") ? statFound() : statNotFound(),
    );
    mockReadFileSync.mockReturnValue(
      JSON.stringify([
        { source: "doc.md", index: 0, chunk: "hello world", embedding: new Array(128).fill(0) },
      ]),
    );
    mockSearchRelevantChunks.mockResolvedValue([]);

    const result = await searchDocs({ query: "hello" }, "/fake/root");

    expect(mockSearchRelevantChunks).toHaveBeenCalledOnce();
    expect(result).toContain("未找到相关文档");
  });

  it("picks up newly created index files on subsequent calls (mtime change → reload)", async () => {
    // 第一次：文件不存在 → 缓存为空
    mockStatSync.mockImplementation(() => statNotFound());

    const first = await searchDocs({ query: "test" }, "/fake/root");
    expect(first).toContain("文档索引尚未建立");

    // 第二次：文件被创建（mtime 从 0 变为 1000 → 触发 reload）
    mockStatSync.mockImplementation((p: string) =>
      p.endsWith("vectors.json") ? statFound(2000) : statNotFound(),
    );
    mockReadFileSync.mockReturnValue(
      JSON.stringify([
        { source: "new.md", index: 0, chunk: "fresh content", embedding: new Array(128).fill(0) },
      ]),
    );
    mockSearchRelevantChunks.mockResolvedValue([
      {
        entry: {
          source: "new.md",
          index: 0,
          chunk: "fresh content",
          embedding: new Array(128).fill(0),
        },
        score: 0.95,
      },
    ]);

    const second = await searchDocs({ query: "test" }, "/fake/root");

    // 应该成功加载新索引
    expect(second).not.toContain("文档索引尚未建立");
    expect(mockSearchRelevantChunks).toHaveBeenCalledOnce();
  });

  it("reuses cache when mtime has not changed", async () => {
    // 第一次调用：加载并缓存
    mockStatSync.mockImplementation((p: string) =>
      p.endsWith("vectors.json") ? statFound(3000) : statNotFound(),
    );
    mockReadFileSync.mockReturnValue(
      JSON.stringify([
        {
          source: "cached.md",
          index: 0,
          chunk: "cached content",
          embedding: new Array(128).fill(0),
        },
      ]),
    );
    mockSearchRelevantChunks.mockResolvedValue([]);

    // 两个候选路径都匹配，各读一次
    await searchDocs({ query: "first" }, "/fake/root");
    expect(mockReadFileSync).toHaveBeenCalledTimes(2);

    // 第二次调用：mtime 相同 → 命中缓存，不读文件
    const second = await searchDocs({ query: "second" }, "/fake/root");

    expect(mockReadFileSync).toHaveBeenCalledTimes(2); // 仍然是 2 次，缓存命中
    expect(second).toContain("未找到相关文档");
  });

  it("reloads when mtime changes (index updated)", async () => {
    // 第一次：mtime=4000 → 加载两个候选路径
    mockStatSync.mockImplementation((p: string) =>
      p.endsWith("vectors.json") ? statFound(4000) : statNotFound(),
    );
    mockReadFileSync.mockReturnValue(
      JSON.stringify([
        { source: "v1.md", index: 0, chunk: "version 1", embedding: new Array(128).fill(0) },
      ]),
    );
    mockSearchRelevantChunks.mockResolvedValue([]);

    await searchDocs({ query: "first" }, "/fake/root");
    expect(mockReadFileSync).toHaveBeenCalledTimes(2);

    // 第二次：mtime 变为 5000 → 缓存失效，重新加载两个路径
    mockStatSync.mockImplementation((p: string) =>
      p.endsWith("vectors.json") ? statFound(5000) : statNotFound(),
    );
    mockReadFileSync.mockReturnValue(
      JSON.stringify([
        { source: "v2.md", index: 0, chunk: "version 2", embedding: new Array(128).fill(0) },
      ]),
    );

    await searchDocs({ query: "second" }, "/fake/root");
    expect(mockReadFileSync).toHaveBeenCalledTimes(4);
  });
});
