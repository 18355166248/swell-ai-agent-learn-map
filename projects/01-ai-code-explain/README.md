# 项目 01：AI 代码解释器

> 对应学习周次：Week 1–2
> 当前状态：v2 已完成本地测试、构建验证，支持两个后端（Anthropic / OpenAI）以及 `--file` / `--dir` / `--stream`

> Week 2 进展：两个 CLI 已支持 `--file` / `--dir`，OpenAI CLI 支持 `--stream` 增量输出

## 当前验证状态

- 已验证：Prompt 组装测试通过、TypeScript 构建通过、CLI 入口可执行、真实文件端到端分析可返回结果
- 当前限制：Codex 执行环境不允许直接把工作区源码发送到外部模型服务，因此真实模型验证是由用户在本机终端补做

## 上下文与长文档处理

- 使用 `tiktoken` 统计 token；若编码器不可用，会回退到字符估算。
- 截断预算按真实 prompt 计算：`system prompt + user prompt + max_tokens + safety margin`，不是只看原始文件内容。
- 长文件默认采用“头尾保留 + 中间截断”，并在 `stderr` 打印 `[长文档处理]` 警告。
- 如果模型仍返回 `context too long`，分析器会自动进一步压缩一次再重试，避免边界场景直接失败。
- 目录总结也会对逐文件 JSON 结果做同样的预算控制。

## 输出语言策略

- 输出语言默认跟随用户问题的语言。
- `question` 为纯英文时，`summary` / `dependencies` / `components` / `risks` 内容返回英文。
- `question` 为中文或中英混合时，结果内容返回中文。
- 未传 `question` 时，默认返回中文。

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

说明：

- `cli.ts` 优先读取 `ANTHROPIC_BASE_URL`，用于 Anthropic/deepgate 兼容网关。
- `cli.ts` 不再读取 `OPENAI_BASE_URL`，避免和 OpenAI CLI 互相影响。
- `ANTHROPIC_BASE_URL` 需要显式填写正确的 Anthropic/deepgate 兼容地址；代码不会再自动裁剪 `/v1` 或 `/messages`。

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

说明：

- `cli-openai.ts` 默认请求 `https://openrouter.ai/api/v1`，所以只填 `OPENAI_API_KEY` 也能直接跑。
- 如果你显式设置了 `OPENAI_BASE_URL`，请确保它仍然指向 OpenRouter 或兼容 OpenRouter 模型 ID 的网关；否则使用 `openai/gpt-oss-120b:free` 这类模型名会返回 `404 Not Found`。

### OpenRouter 免费模型推荐

| 模型                                     | 上下文 | 特点              |
| ---------------------------------------- | ------ | ----------------- |
| `openai/gpt-oss-120b:free`               | 128K   | OpenAI 开源大模型 |
| `qwen/qwen3-coder:free`                  | 262K   | 代码专用          |
| `deepseek/deepseek-v4-flash:free`        | 1M     | 速度快            |
| `meta-llama/llama-3.3-70b-instruct:free` | 128K   | Meta 旗舰         |

## 测试方法

```bash
# 跑单元测试
npm test

# 基础文件分析
npx tsx projects/01-ai-code-explain/cli-openai.ts \
  projects/01-ai-code-explain/examples/sample.tsx

# 验证长文截断（stderr 应出现 [长文档处理]）
npx tsx projects/01-ai-code-explain/cli-openai.ts --file \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  "这个文件的核心职责是什么？"

# 验证语言跟随：英文问题 -> 英文结果
OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
npx tsx projects/01-ai-code-explain/cli-openai.ts --file \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  --model openai/gpt-oss-120b:free \
  "What is the core responsibility of this file?"

# 验证语言跟随：中文问题 -> 中文结果
OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
npx tsx projects/01-ai-code-explain/cli-openai.ts --file \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  --model openai/gpt-oss-120b:free \
  "这个文件的核心职责是什么？"

# 验证 streaming 与 stdout/stderr 分流
npx tsx projects/01-ai-code-explain/cli-openai.ts \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  --stream 1>out.json 2>stream.log

# 验证目录总结
npx tsx projects/01-ai-code-explain/cli.ts --dir \
  projects/01-ai-code-explain/src \
  "概括这个目录的主要模块职责"
```

可直接用于长文测试的样例文件：

- `projects/01-ai-code-explain/examples/long-context-sample.ts`

## 迭代计划

| 版本 | 功能                       | 对应周 |
| ---- | -------------------------- | ------ |
| v1   | 分析单个文件，JSON 输出    | Week 1 |
| v2   | --file / --dir / streaming | Week 2 |
