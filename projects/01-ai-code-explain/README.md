# 项目 01：AI 代码解释器

> 对应学习周次：Week 1–2
> 当前状态：目录已建，代码尚未开始实现

## 目标能力

完成后预期支持：

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

## 当前目录状态

当前仓库内实际已有：

```text
01-ai-code-explain/
├── README.md
└── src/
    └── .gitkeep
```

## 计划目录结构

下面是后续实现时希望演进到的结构：

```text
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

## 开始实现时的建议步骤

```bash
cd projects/01-ai-code-explain
# 1. 初始化 package.json
# 2. 创建 .env.example
# 3. 实现 cli.js 和 src/analyzer.ts
# 4. 再补充真实可执行命令
```

在这些文件真正落地前，不建议把本页命令当成“已经能跑”使用。
