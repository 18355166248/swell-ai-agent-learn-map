# Week 3 学习笔记

## Embedding 的直觉理解

Embedding 是将一段文本映射到高维空间中的一个点（向量）。OpenAI 的 `text-embedding-3-small` 输出 1536 维向量。

核心直觉：

- 语义相近的文本，向量在空间中距离更近（Cosine Similarity 接近 1）
- 向量之间的距离反映的是"含义的相似度"，而非关键词匹配
- 代码里看到的 1536 个浮点数，本质上是模型对文本的"理解压缩"

## Cosine Similarity 实现

```typescript
export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return magA === 0 || magB === 0 ? 0 : dot / (magA * magB);
}
```

结果范围 [-1, 1]，值越大越相似。

## Chunk 切分实验

当前策略：按 `\n\n`（双换行）切原始段落，然后合并短段落使每块尽量接近 300-500 字符。

测试 `upload-cdn.md`（约 1.5KB）→ 切出 3 个 chunk：

1. 概述 + 流程图
2. 接口定义
3. 异常处理 + 注意事项

效果：检索时 Top-1 相似度 0.71，结果相关。

## 踩坑记录

1. **根 .env 的 MODEL_NAME 冲突**：根 `.env` 的 `MODEL_NAME=official-deepseek-v4-pro` 是 Anthropic CLI 用的，ask.ts 直接读取会导致 OpenRouter 400。解决方案：ask.ts 硬编码 OpenRouter 免费模型，不读 MODEL_NAME。
2. **embedding 模型选择**：`openai/text-embedding-3-small` 在 OpenRouter 上免费可用，1536 维，性价比高。

## 下周要带走的问题

- Chunk 大小如何影响检索精度？
- 如果文档很大（100+ chunk），相似度计算会变慢吗？
