# 项目 02：文档 RAG 问答系统

> 对应学习周次：Week 3–5
> 当前状态：v3 已完成，支持 Query 改写 + 混合检索 + 安全加固

## 已实现功能

- CLI 文档索引和问答（`index.ts` / `ask.ts`）
- Express Web 服务 + API（`server.ts`），Query 改写默认启用
- Web UI 上传 + 提问 + 来源展示（`public/index.html`），支持改写/混合开关
- 向量检索 + 结构化输出（`retriever.ts` / `rag.ts`）
- BM25 关键词检索 + RRF 混合融合（`keyword-search.ts`）
- 按标题语义切分（`chunker-heading.ts`，备选策略）
- 文档切分 + Embedding 调用（`chunker.ts` / `embedder.ts`）
- 路径穿越防护、文件大小限制、大小写扩展名兼容

## 快速开始

```bash
cd projects/02-doc-rag
npm install

# 1) 索引知识库文档
npm run index -- ./docs/knowledge-base/

# 2) CLI 问答
npm run ask -- "图片上传 CDN 的流程是什么？"

# 3) 启动 Web 服务
npm start
# 访问 http://localhost:8081
```

> 环境变量从仓库根目录 `.env` 统一加载；项目也可以自建 `projects/02-doc-rag/.env` 补充项目特定配置（不会覆盖已设的环境变量）。

## 目录结构

```text
02-doc-rag/
├── src/
│   ├── index.ts          # 文档索引（切分 + embedding + 存储）
│   ├── ask.ts            # CLI 问答（流式输出）
│   ├── server.ts         # Express Web 服务 + API
│   ├── rag.ts            # RAG 核心模块（可复用，返回 answer + sources）
│   ├── retriever.ts      # 余弦相似度检索
│   ├── chunker.ts        # 段落切分策略
│   ├── embedder.ts       # Embedding API 封装
│   └── __tests__/        # 单元测试
├── public/
│   └── index.html        # Web UI
├── docs/
│   └── knowledge-base/   # 知识库 Markdown 文档
├── .data/
│   └── vectors.json      # 本地向量存储（自动生成，已 gitignore）
└── package.json
```

## API 端点

| 端点          | 方法 | 说明                                   |
| ------------- | ---- | -------------------------------------- |
| `/`           | GET  | Web UI 界面                            |
| `/api/status` | GET  | 查看索引状态                           |
| `/api/index`  | POST | 上传 .md/.txt 并重建索引               |
| `/api/ask`    | POST | RAG 问答，返回 `{ answer, sources[] }` |

## 迭代计划

| 版本 | 功能                                         | 对应周    |
| ---- | -------------------------------------------- | --------- |
| v1   | 内存数组 + JSON 存储，命令行问答             | Week 3 ✅ |
| v2   | Express API + Web UI + 引用来源 + 安全加固   | Week 4 ✅ |
| v3   | Query 改写(默认) + 混合检索(可选) + 标题切分 | Week 5 ✅ |
