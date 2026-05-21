# 项目 04：前端研发知识库助手（最终作品）

> 对应学习周次：Week 7–8
> 别名：AI Dev Copilot for Frontend Workflow

## 这是什么

把前 3 个项目的能力整合在一起，做成一个真正服务日常开发的 AI 工具。

```
你：帮我分析这个需求需要改哪些文件

Agent：
  [查文档] 检索上传规范 → 需要用 uploadImage SDK
  [查代码] 搜索 activity 相关文件 → 找到 3 个相关文件
  [读文件] 读取 hooks/useUpload.ts → 确认现有实现
  [分析]   结合需求和现有代码，输出改动方案
```

## 核心能力

| 能力     | 描述                                       |
| -------- | ------------------------------------------ |
| 文档问答 | 查内部规范，带引用来源                     |
| 需求分析 | 输入需求，输出改动点/接口/埋点/风险/测试点 |
| 代码检索 | 按语义找相关文件和代码片段                 |
| 方案生成 | Agent 多步推理，自动生成开发方案           |

## 目录结构

```
04-dev-copilot/
├── cli.js                    # 命令行入口
├── src/
│   ├── agent/
│   │   ├── index.ts          # Agent 主循环（ReAct）
│   │   ├── tools/
│   │   │   ├── readFile.ts
│   │   │   ├── listFiles.ts
│   │   │   ├── searchCode.ts
│   │   │   ├── searchDocs.ts
│   │   │   └── grep.ts
│   │   └── prompts.ts
│   ├── rag/                  # 复用 02-doc-rag 的逻辑
│   │   ├── indexer.ts
│   │   └── retriever.ts
│   ├── analyst/              # 复用 03-req-analyst 的逻辑
│   │   └── analyze.ts
│   └── server.ts             # Web 服务
├── public/
│   └── index.html            # Web UI
├── docs/
│   └── knowledge-base/       # 内部文档（勿提交敏感内容）
├── .data/
│   └── vectors.json          # 向量存储（自动生成，勿提交）
├── package.json
└── .env.example
```

## 迭代计划

| 版本 | 功能                                         | 对应周 |
| ---- | -------------------------------------------- | ------ |
| v1   | 只读工具 Agent（read/list/search）+ 需求分析 | Week 7 |
| v2   | 功能整合 + Web UI + 引用来源 + 技术分享版本  | Week 8 |

## 快速开始

```bash
cd projects/04-dev-copilot
cp .env.example .env
npm install

# 把内部文档放入 docs/knowledge-base/
# 建立索引
npm run index

# 命令行使用
node cli.js "帮我分析这个需求需要改哪些文件"

# Web 界面
npm start
# 访问 http://localhost:3000
```

## 业务价值（技术分享用）

```
场景              传统方式          使用后
需求分析          30 分钟人工梳理   5 分钟 AI 输出初稿
查内部文档        翻 Confluence     自然语言直接问
新人熟悉代码      1 周看代码        随时问随时答
规范一致性        靠人记忆          AI 自动带出规范引用
```
