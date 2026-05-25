# 项目 01：AI 代码解释器

> 对应学习周次：Week 1–2
> 当前状态：v2 已完成本地测试、构建验证，支持两个后端（Anthropic / OpenAI）以及 `--file` / `--dir` / `--stream`

> Week 2 进展：两个 CLI 已支持 `--file` / `--dir`，OpenAI CLI 支持 `--stream` 增量输出

## 当前验证状态

- 已验证：Prompt 组装测试通过、TypeScript 构建通过、CLI 入口可执行、真实文件端到端分析可返回结果
- 当前限制：Codex 执行环境不允许直接把工作区源码发送到外部模型服务，因此真实模型验证是由用户在本机终端补做

## 输出格式

文件模式（以 `examples/sample.tsx` 为例）：

```json
{
  "mode": "file",
  "target": "examples/sample.tsx",
  "result": {
    "summary": "这是一个移动端首页组件，展示用户信息、Banner 轮播和活动卡片列表",
    "dependencies": ["@/hooks/useUserInfo", "@/api/home"],
    "components": ["BannerSwiper", "ActivityCard"],
    "risks": ["useEffect 未处理异步错误", "activities 列表 key 依赖 item.id 需确保唯一"]
  }
}
```

目录模式（以 `examples/` 为例）：

```json
{
  "mode": "dir",
  "target": "examples",
  "summary": "该目录包含一个移动端首页示例组件，涉及用户信息获取、活动列表展示。",
  "files": [
    {
      "path": "sample.tsx",
      "result": {
        "summary": "移动端首页组件，展示用户信息、Banner 和活动卡片",
        "dependencies": ["@/hooks/useUserInfo", "@/api/home"],
        "components": ["BannerSwiper", "ActivityCard"],
        "risks": ["异步错误未处理"]
      }
    }
  ]
}
```

## 当前目录结构

```text
01-ai-code-explain/
├── cli.ts                  # Anthropic 版 CLI（内部 deepseek-v4-pro）
├── cli-openai.ts           # OpenAI 版 CLI（OpenRouter 免费模型）
├── src/
│   ├── types.ts            # 输出信封类型定义
│   ├── cli-options.ts      # CLI 参数解析
│   ├── target-loader.ts    # 文件/目录读取与收集
│   ├── run-analysis.ts     # 分析流程编排
│   ├── prompts.ts          # 共享 Prompt 模板
│   ├── analysis-result.ts  # 分析结果解析
│   ├── analyzer.ts         # Anthropic SDK 分析器
│   ├── analyzer-openai.ts  # OpenAI SDK 分析器（含流式输出）
│   └── __tests__/          # 单元测试
├── examples/
│   └── sample.tsx          # 示例文件（可直接用于测试分析）
├── .env                    # Anthropic 版配置
├── .env.openai             # OpenAI/OpenRouter 版配置
└── .env.example
```

## 运行方法

### 方式 A：Anthropic SDK（内部 deepseek-v4-pro）

```bash
cp .env.example .env          # 编辑填入 ANTHROPIC_API_KEY 等

# 分析单文件
npx tsx cli.ts examples/sample.tsx
npx tsx cli.ts examples/sample.tsx "这个组件依赖了哪些接口？"
npx tsx cli.ts --file examples/sample.tsx "useUserInfo 来自哪里？"

# 分析目录
npx tsx cli.ts --dir examples "这个目录做了什么？"
```

### 方式 B：OpenAI SDK（OpenRouter 免费模型）

```bash
cp .env.openai.example .env.openai   # 编辑填入 OPENAI_API_KEY

# 分析单文件
npx tsx cli-openai.ts examples/sample.tsx
npx tsx cli-openai.ts examples/sample.tsx "这个组件依赖了哪些接口？"
npx tsx cli-openai.ts --file examples/sample.tsx "useUserInfo 来自哪里？"

# 流式输出
npx tsx cli-openai.ts examples/sample.tsx --stream
npx tsx cli-openai.ts --file examples/sample.tsx --stream

# 分析目录
npx tsx cli-openai.ts --dir examples "这个目录做了什么？"

# 切换免费模型
npx tsx cli-openai.ts examples/sample.tsx --model openai/gpt-oss-120b:free
npx tsx cli-openai.ts examples/sample.tsx --model deepseek/deepseek-v4-flash:free

# 查看可用免费模型
npx tsx cli-openai.ts --list-models
```

### OpenRouter 免费模型推荐

| 模型                                     | 上下文 | 特点              |
| ---------------------------------------- | ------ | ----------------- |
| `openai/gpt-oss-120b:free`               | 128K   | OpenAI 开源大模型 |
| `qwen/qwen3-coder:free`                  | 1M     | 代码专用          |
| `deepseek/deepseek-v4-flash:free`        | 1M     | 速度快            |
| `meta-llama/llama-3.3-70b-instruct:free` | 128K   | Meta 旗舰         |

## 迭代计划

| 版本 | 功能                       | 对应周 |
| ---- | -------------------------- | ------ |
| v1   | 分析单个文件，JSON 输出    | Week 1 |
| v2   | --file / --dir / streaming | Week 2 |
