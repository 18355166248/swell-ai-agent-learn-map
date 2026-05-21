# 项目 02：文档 RAG 问答系统

> 对应学习周次：Week 3–5

## 功能

```bash
# 索引文档
node src/index.js ./docs/knowledge-base/

# 命令行问答
node src/ask.js "图片上传 CDN 的流程是什么？"

# 启动 Web 服务
npm start
# 访问 http://localhost:3000
```

## 目录结构

```
02-doc-rag/
├── src/
│   ├── index.ts          # 文档索引（切分 + embedding + 存储）
│   ├── ask.ts            # 命令行问答入口
│   ├── server.ts         # Express Web 服务
│   ├── retriever.ts      # 向量检索逻辑
│   ├── chunker.ts        # 文档切分策略
│   └── embedder.ts       # Embedding 调用封装
├── public/
│   └── index.html        # 最简 Web UI
├── docs/
│   └── knowledge-base/   # 放你的 Markdown 文档
├── .data/
│   └── vectors.json      # 本地向量存储（自动生成，勿提交）
├── package.json
└── .env.example
```

## 迭代计划

| 版本 | 功能                                 | 对应周 |
| ---- | ------------------------------------ | ------ |
| v1   | 内存数组 + JSON 存储，命令行问答     | Week 3 |
| v2   | Express API + 基础 Web UI + 引用来源 | Week 4 |
| v3   | 按标题切分 + Query 改写 + 混合检索   | Week 5 |

## 快速开始

```bash
cd projects/02-doc-rag
cp .env.example .env
npm install

# 把你的文档放进 docs/knowledge-base/
cp your-doc.md docs/knowledge-base/

# 建立索引
node src/index.js ./docs/knowledge-base/

# 提问
node src/ask.js "你的问题"

# 或启动 Web
npm start
```
