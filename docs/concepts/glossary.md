# 术语表

> 遇到新概念就补进来，用自己的话解释。

## A

**Agent**
让 AI 自主决定调用哪些工具、以什么顺序执行，来完成一个复杂任务。区别于 RAG（一问一答），Agent 是多步循环推理。

**API Key**
调用 OpenAI 等模型服务的身份凭证。放进 `.env` 文件，不要提交到 git。

## B

**BM25**
一种传统的关键词检索算法（Best Match 25），对精确词匹配效果好。与向量检索互补，合称 Hybrid Search。

## C

**Chunk**
把长文档切成的小块。RAG 的基本单位——检索时找的是 chunk，不是整篇文档。

**Context Window（上下文窗口）**
模型一次能处理的最大 token 数。GPT-4o 是 128K tokens，约等于 10 万汉字。

**Cosine Similarity（余弦相似度）**
衡量两个向量方向相近程度的指标，值域 -1 到 1，越接近 1 越相似。RAG 中用来找最相关的 chunk。

## E

**Embedding**
把文本转换成高维数字向量的过程。语义相近的文本，其向量在空间中距离也近。

## F

**Function Calling / Tool Calling**
让模型输出"我要调用某个函数，参数是 XXX"，然后由你的代码真正执行这个函数。Agent 的核心机制。

## G

**Generation**
RAG 中的 G，指把检索到的 context 和用户问题一起交给模型，让它生成最终答案。

## H

**Hallucination（幻觉）**
模型自信地编造不存在的事实。RAG 加引用来源是缓解幻觉的有效方式。

**Hybrid Search（混合检索）**
向量检索 + 关键词检索（BM25）的结合，工程文档场景下综合效果最好。

## L

**LLM（Large Language Model）**
大语言模型，如 GPT-4o、Claude、Deepseek。

## M

**max_tokens**
控制模型单次回复的最大长度。

## P

**Prompt**
你发给模型的输入文本。包括 System Prompt（角色设定）和 User Prompt（用户消息）。

## R

**RAG（Retrieval-Augmented Generation）**
检索增强生成。先从知识库检索相关内容，再把检索结果作为上下文让模型回答，避免模型凭记忆瞎编。

**ReAct**
一种 Agent 推理模式：Reasoning（思考）+ Acting（行动）交替进行。

```
Thought: 我需要先了解项目结构
Action: list_files("./src")
Observation: [找到的文件列表]
Thought: 下一步...
```

**Retrieval**
RAG 中的 R，指从向量数据库中找出与用户问题最相关的 chunk。

## S

**Streaming**
让模型的回复像打字机一样逐字输出，而不是等全部生成完才返回。提升体验。

**Structured Output**
让模型严格按指定 JSON 格式输出，便于程序解析。

**System Prompt**
对话开始前设定 AI 的角色、能力范围和行为准则的提示词。

## T

**Temperature**
控制模型输出的随机性。0 = 最确定（适合结构化输出），1 = 更有创意（适合内容生成）。

**Token**
模型处理文本的基本单位。大致上 1 个英文单词 ≈ 1-2 tokens，1 个中文字 ≈ 1-2 tokens。

**Top-K**
向量检索时返回最相似的 K 个结果（通常 K=3 或 K=5）。

## V

**Vector DB（向量数据库）**
专门存储和检索向量的数据库，如 pgvector、Pinecone、Chroma、Weaviate。
