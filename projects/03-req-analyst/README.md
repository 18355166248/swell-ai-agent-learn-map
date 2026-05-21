# 项目 03：需求分析助手

> 对应学习周次：Week 6
> 当前状态：目录骨架已建，输出结构已定义，尚未开始实现

## 目标能力

完成后预期支持：

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

## 当前目录状态

当前仓库内实际已有：

```text
03-req-analyst/
├── README.md
├── docs/
│   └── knowledge-base/
│       └── .gitkeep
├── examples/
│   └── .gitkeep
└── src/
    └── .gitkeep
```

## 计划目录结构

下面是后续实现目标：

```text
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

## 开始实现时的建议步骤

```bash
cd projects/03-req-analyst
# 1. 先复用 02-doc-rag 的索引与检索逻辑
# 2. 再补 analyst.ts 和结构化输出 Prompt
# 3. 最后补 CLI 或 Web 入口
```
