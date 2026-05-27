# 项目 02：文档 RAG 问答系统

> 对应学习周次：Week 3–5
> 当前状态：目录骨架已建，README 记录的是目标方案，不是现成可运行实现

## 目标能力

完成后预期支持：

```bash
# 索引文档
npx tsx src/index.ts ./docs/knowledge-base/

# 命令行问答
npx tsx src/ask.ts "图片上传 CDN 的流程是什么？"

# 启动 Web 服务
npm start
# 访问 http://localhost:3000
```

## 当前目录状态

当前仓库内实际已有：

```text
02-doc-rag/
├── README.md
├── docs/
│   └── knowledge-base/
│       └── .gitkeep
└── src/
    └── .gitkeep
```

## 计划目录结构

下面是后续实现目标：

```text
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

## 开始实现时的建议步骤

```bash
cd projects/02-doc-rag
# 1. 初始化 package.json 和运行脚本
# 2. 创建 .env.example
# 3. 先完成 index.ts / ask.ts 最小命令行版本
# 4. 再补 npm start 和 Web UI
```

说明：本页命令口径已统一为 `src/*.ts` 的目标实现形式；在对应脚本落地前，这些命令仍属于预期命令。
