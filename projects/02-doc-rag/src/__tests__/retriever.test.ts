import { describe, it, expect } from "vitest";
import { dotProduct, magnitude, cosineSimilarity, retrieve } from "../retriever.js";
import type { VectorEntry } from "../retriever.js";

describe("dotProduct", () => {
  it("两个相同向量点积应为各元素平方和", () => {
    expect(dotProduct([1, 2, 3], [1, 2, 3])).toBe(14); // 1+4+9
  });

  it("正交向量点积应为 0", () => {
    expect(dotProduct([1, 0], [0, 1])).toBe(0);
  });

  it("全零向量点积应为 0", () => {
    expect(dotProduct([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("维度不匹配时应抛出错误", () => {
    expect(() => dotProduct([1, 2], [1, 2, 3])).toThrow("维度不匹配");
  });

  it("1536 维向量（模拟 embedding 输出）", () => {
    const a = Array.from({ length: 1536 }, (_, i) => 0.01 * (i % 10));
    const b = Array.from({ length: 1536 }, (_, i) => 0.01 * ((i + 1) % 10));
    // 不应抛错
    const result = dotProduct(a, b);
    expect(typeof result).toBe("number");
    expect(Number.isFinite(result)).toBe(true);
  });
});

describe("magnitude", () => {
  it("[3, 4] 的模应为 5", () => {
    expect(magnitude([3, 4])).toBe(5);
  });

  it("全零向量模为 0", () => {
    expect(magnitude([0, 0, 0])).toBe(0);
  });

  it("单一元素", () => {
    expect(magnitude([7])).toBe(7);
  });
});

describe("cosineSimilarity", () => {
  it("相同向量余弦相似度为 1", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("方向完全相反的向量余弦相似度为 -1", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it("正交向量余弦相似度为 0", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 10);
  });

  it("零向量应返回 0（边界保护）", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });

  it("两个正数向量应有正相似度", () => {
    const sim = cosineSimilarity([0.1, 0.2, 0.3], [0.15, 0.25, 0.35]);
    expect(sim).toBeGreaterThan(0.99); // 方向几乎一致
  });
});

describe("retrieve", () => {
  // query=[1,0,0] → chunk0 完全一致，chunk1 有部分重叠，chunk2 正交
  const entries: VectorEntry[] = [
    {
      chunk: "图片上传 CDN 流程",
      embedding: [1, 0, 0],
      source: "upload.md",
      index: 0,
    },
    {
      chunk: "用户认证流程",
      embedding: [0.8, 0.3, 0],
      source: "auth.md",
      index: 0,
    },
    {
      chunk: "性能优化建议",
      embedding: [0, 1, 0],
      source: "perf.md",
      index: 0,
    },
  ];

  const query = [1, 0, 0]; // 和 chunk0 完全一致

  it("默认 topK=3 返回全部结果按相似度降序", () => {
    const results = retrieve(query, entries);
    expect(results).toHaveLength(3);
    expect(results[0].entry.chunk).toBe("图片上传 CDN 流程");
    expect(results[0].similarity).toBeCloseTo(1, 10);
    // 后续相似度递减
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
  });

  it("topK=2 只返回前两条", () => {
    const results = retrieve(query, entries, 2);
    expect(results).toHaveLength(2);
    expect(results[0].entry.chunk).toBe("图片上传 CDN 流程");
  });

  it("topK=1 只返回最相似的一条", () => {
    const results = retrieve(query, entries, 1);
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBeCloseTo(1, 10);
  });

  it("条目数少于 topK 时返回所有条目", () => {
    const results = retrieve(query, entries, 10);
    expect(results).toHaveLength(3);
  });

  it("空条目返回空数组", () => {
    expect(retrieve(query, [])).toEqual([]);
  });

  it("结果包含 source 和 index 元数据", () => {
    const results = retrieve(query, entries);
    expect(results[0].entry.source).toBe("upload.md");
    expect(results[0].entry.index).toBe(0);
  });
});
