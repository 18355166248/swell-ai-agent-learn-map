# 项目 01：AI 代码解释器

> 对应学习周次：Week 1–2

## 功能

```bash
# 分析单个文件
node cli.js ./src/pages/home/index.tsx

# 带问题分析文档
node cli.js --file ./docs/activity-config.md "这个字段怎么配置？"

# 分析整个目录
node cli.js --dir ./src/utils "找出所有工具函数的作用"
```

## 输出格式

```json
{
  "summary": "这个文件是首页组件，负责...",
  "dependencies": ["useUserInfo hook", "/api/home 接口"],
  "components": ["BannerSwiper", "ActivityCard"],
  "risks": ["未处理接口报错时的兜底状态"],
  "suggestions": ["建议提取 BannerSwiper 为独立组件"]
}
```

## 目录结构

```
01-ai-code-explain/
├── cli.js              # 入口，处理命令行参数
├── src/
│   ├── analyzer.ts     # 核心：读文件 + 调模型
│   └── prompts.ts      # Prompt 模板
├── package.json
└── .env.example
```

## 迭代计划

| 版本 | 功能                                                  | 对应周 |
| ---- | ----------------------------------------------------- | ------ |
| v1   | 分析单个 .tsx 文件，JSON 输出                         | Week 1 |
| v2   | 支持 --file（文档问答）+ --dir（批量分析）+ streaming | Week 2 |

## 快速开始

```bash
cd projects/01-ai-code-explain
cp .env.example .env
# 填入 OPENAI_API_KEY
npm install
node cli.js ./path/to/your/file.tsx
```
