# Week 3：Embedding + 向量检索

**时间**：2026-06-04 – 2026-06-10
**状态**：⬜ 未开始

## 本周目标

> 搞懂 RAG 的核心：不是把所有文档塞给 AI，而是先搜索相关内容再给 AI 总结。

## 要学的概念

- [ ] Embedding：文本 → 高维数字向量，语义相近的向量距离近
- [ ] Cosine Similarity：衡量两个向量相似度的方法
- [ ] Chunk：把长文档切成小块的策略
- [ ] Top-K 检索：返回最相似的 K 个 chunk
- [ ] 为什么不能把全文档塞给模型（token 限制 + 噪声问题）

## 核心公式

```
cosine_similarity(a, b) = (a · b) / (|a| × |b|)
结果范围：-1 到 1，越接近 1 表示越相似
```

## 实践项目

**`../../projects/02-doc-rag/`**（骨架搭建）

```bash
# 第一步：索引文档
node src/index.js ./docs/

# 第二步：提问
node src/ask.js "图片上传 CDN 的流程是什么？"
```

第一版用内存数组 + JSON 文件，不用真正的向量数据库。

## 数据流

```
读取 Markdown 文档
  ↓
按段落切 chunk（每块约 300-500 字）
  ↓
调用 Embedding API 向量化每个 chunk
  ↓
保存到本地 JSON（chunk 文本 + 向量 + 来源文件 + 行号）
  ↓
用户提问 → 向量化问题
  ↓
计算与所有 chunk 的相似度 → 取 Top 3
  ↓
把 Top 3 chunk 拼入 Prompt → 模型回答
```

## 每日安排

| 天   | 目标                                   | 完成？ |
| ---- | -------------------------------------- | ------ |
| 周一 | 调用 Embedding API，打印一段文字的向量 | ⬜     |
| 周二 | 手写 Cosine Similarity，测试搜索效果   | ⬜     |
| 周三 | 实现文档按段落切分                     | ⬜     |
| 周四 | 批量 embedding + 存到 JSON             | ⬜     |
| 周五 | 实现检索：问题 → Top 3 chunk           | ⬜     |
| 周末 | 把检索结果拼成 Prompt，让模型回答      | ⬜     |

## 产出 checklist

- [ ] 能把一个 Markdown 文件向量化并存到本地
- [ ] 输入问题能返回最相关的 3 个文本段落
- [ ] `projects/02-doc-rag/` 有骨架代码
- [ ] `notes.md` 记录 Embedding 的直觉理解
