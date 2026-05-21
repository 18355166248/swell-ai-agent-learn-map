# 项目 03：需求分析助手

> 对应学习周次：Week 6

## 功能

```bash
# 命令行：分析需求文本
node cli.js "春节分享活动需要新增图片上传和分享海报能力"

# 命令行：分析需求文档文件
node cli.js --file ./prd.md

# Web 界面
npm start
```

## 输出格式

```json
{
  "pages": ["活动详情页需要新增上传入口", "分享海报弹窗（新增）"],
  "interfaces": ["POST /api/activity/upload", "GET /api/poster/template"],
  "tracking": [
    { "event": "activity_upload_click", "params": ["activity_id", "channel"] },
    { "event": "poster_share_click", "params": ["activity_id", "poster_type"] }
  ],
  "components": ["ImageUploader（复用）", "PosterModal（新增）"],
  "risks": ["图片上传需处理超大文件", "海报生成可能有跨域问题"],
  "testPoints": ["上传成功/失败流程", "海报分享各渠道测试", "弱网环境"],
  "sources": [{ "file": "upload-spec.md", "lines": "12-18" }]
}
```

## 目录结构

```
03-req-analyst/
├── cli.js
├── src/
│   ├── analyst.ts        # 核心分析逻辑
│   ├── prompts.ts        # 结构化输出 Prompt
│   └── server.ts         # Web 服务（可选）
├── docs/
│   └── knowledge-base/   # 内部规范文档
│       ├── upload-spec.md
│       ├── tracking-spec.md
│       └── component-guide.md
├── examples/             # 测试用需求案例
│   ├── case-01.md
│   └── case-02.md
├── package.json
└── .env.example
```

## 迭代计划

| 版本 | 功能                                    | 对应周 |
| ---- | --------------------------------------- | ------ |
| v1   | 接入真实文档，结构化分析输出            | Week 6 |
| v2   | 集成到 dev-copilot，作为一个 Agent 工具 | Week 7 |

## 快速开始

```bash
cd projects/03-req-analyst
cp .env.example .env
npm install

# 把内部规范文档放到 docs/knowledge-base/
# 建立索引（复用 02-doc-rag 的 indexer）

node cli.js "你的需求描述"
```
