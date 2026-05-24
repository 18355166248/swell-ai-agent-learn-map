# 项目 01：AI 代码解释器

> 对应学习周次：Week 1–2
> 当前状态：v1 已可运行，支持两个后端（Anthropic / OpenAI）

## 输出格式

```json
{
  "summary": "这个文件是首页组件，负责...",
  "dependencies": ["useUserInfo hook", "/api/home 接口"],
  "components": ["BannerSwiper", "ActivityCard"],
  "risks": ["未处理接口报错时的兜底状态"]
}
```

## 当前目录结构

```text
01-ai-code-explain/
├── cli.ts                # Anthropic 版 CLI（内部 deepseek-v4-pro）
├── cli-openai.ts         # OpenAI 版 CLI（OpenRouter 免费模型）
├── src/
│   ├── prompts.ts        # 共享 Prompt 模板
│   ├── analyzer.ts       # Anthropic SDK 分析器
│   └── analyzer-openai.ts # OpenAI SDK 分析器
├── examples/
│   └── sample.tsx
├── .env                  # Anthropic 版配置
├── .env.openai           # OpenAI/OpenRouter 版配置
└── .env.example
```

## 运行方法

### 方式 A：Anthropic SDK（内部 deepseek-v4-pro）

```bash
cp .env.example .env          # 编辑填入 ANTHROPIC_API_KEY 等
npx tsx cli.ts examples/sample.tsx
```

### 方式 B：OpenAI SDK（OpenRouter 免费模型）

```bash
cp .env.openai.example .env.openai   # 编辑填入 OPENAI_API_KEY
npx tsx cli-openai.ts examples/sample.tsx

# 切换免费模型
npx tsx cli-openai.ts examples/sample.tsx --model openai/gpt-oss-120b:free
npx tsx cli-openai.ts examples/sample.tsx --model deepseek/deepseek-v4-flash:free

# 查看可用免费模型
npx tsx cli-openai.ts --list-models
```

### OpenRouter 免费模型推荐

| 模型 | 上下文 | 特点 |
|------|--------|------|
| `openai/gpt-oss-120b:free` | 128K | OpenAI 开源大模型 |
| `qwen/qwen3-coder:free` | 1M | 代码专用 |
| `deepseek/deepseek-v4-flash:free` | 1M | 速度快 |
| `meta-llama/llama-3.3-70b-instruct:free` | 128K | Meta 旗舰 |

## 迭代计划

| 版本 | 功能 | 对应周 |
| ---- | ---- | ------ |
| v1 | 分析单个文件，JSON 输出 | Week 1 |
| v2 | --file / --dir / streaming | Week 2 |
