# Week 2：LLM API 进阶 + 文件问答

**时间**：2026-05-28 – 2026-06-03
**状态**：✅ 完成

## 本周目标

> 把上周的 CLI 升级：支持读取文档文件，处理长文本，流式输出。

## 要学的概念

- [x] Streaming（流式输出）的实现方式
- [x] Token 计算：tiktoken / 手估 / 模型报错时如何处理
- [x] 上下文窗口限制：超出时如何截断或摘要
- [x] 错误处理：rate limit、timeout、context too long 怎么应对
- [x] 多轮对话的消息格式（messages 数组）

## 实践项目

**`../../projects/01-ai-code-explain/`**（升级版）

```bash
# 已完成：OpenAI 版支持 streaming
npx tsx cli-openai.ts examples/sample.tsx --stream

# 本周目标：支持 --file 传入文档
# 目标用法（实现后）
npx tsx cli.ts --file ./docs/activity-config.md "这个字段怎么配置？"

# 本周目标：支持 --dir 分析整个目录
# 目标用法（实现后）
npx tsx cli.ts --dir ./src/utils "找出所有工具函数的作用"
```

## 每日安排

| 天   | 目标                              | 完成？ |
| ---- | --------------------------------- | ------ |
| 周一 | 实现 streaming 输出，体验实时响应 | ✅     |
| 周二 | 学 token 计数，处理超长文件       | ✅     |
| 周三 | 支持 Markdown 文档输入（--file）  | ✅     |
| 周四 | 加错误处理和重试逻辑              | ✅     |
| 周五 | 整理笔记，记录踩坑                | ✅     |
| 周末 | 完整测试 + 写本周总结             | ✅     |

## 产出 checklist

- [x] CLI 支持 `--file` 和 `--dir` 参数
- [x] OpenAI CLI 已支持 streaming 输出（增量内容打印到 stderr）
- [x] 超长文件有处理策略（不直接崩溃）
- [x] `notes.md` 记录本周要点

## 本周实现边界

- 文件分析会按真实 prompt token 预算做截断，不再只按裸文件字符数粗估。
- 如果首次截断后仍被模型判定为 `context too long`，分析器会再做一次更激进的压缩重试。
- 目录总结同样会对逐文件 JSON 结果做预算感知截断，避免大目录直接把 summary 请求撑爆。
- Anthropic 版仍然是非 streaming；OpenAI 版支持 `--stream`，并把增量输出打印到 `stderr`。
- 输出语言跟随用户问题：英文问题返回英文结果，中文或混合问题返回中文；未传问题时默认中文。

## 如何测试

```bash
# 1) 跑单元测试
npm test

# 2) 普通文件分析
npx tsx projects/01-ai-code-explain/cli-openai.ts \
  projects/01-ai-code-explain/examples/sample.tsx

# 3) 长文截断测试（会在 stderr 打印 [长文档处理]）
npx tsx projects/01-ai-code-explain/cli-openai.ts --file \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  "这个文件的核心职责是什么？"

# 3.1) 英文问题 -> 英文结果
OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
npx tsx projects/01-ai-code-explain/cli-openai.ts --file \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  --model openai/gpt-oss-120b:free \
  "What is the core responsibility of this file?"

# 3.2) 中文问题 -> 中文结果
OPENAI_BASE_URL=https://openrouter.ai/api/v1 \
npx tsx projects/01-ai-code-explain/cli-openai.ts --file \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  --model openai/gpt-oss-120b:free \
  "这个文件的核心职责是什么？"

# 4) streaming 与 JSON 分流测试
npx tsx projects/01-ai-code-explain/cli-openai.ts \
  projects/01-ai-code-explain/examples/long-context-sample.ts \
  --stream 1>out.json 2>stream.log

# 5) 目录总结测试
npx tsx projects/01-ai-code-explain/cli.ts --dir \
  projects/01-ai-code-explain/src \
  "概括这个目录的主要模块职责"
```

预期结果：

- `npm test` 全绿
- 长文件测试时 `stderr` 出现 `[长文档处理]`，最终 `stdout` 仍是合法 JSON
- `--stream` 时 `out.json` 只有最终 JSON，`stream.log` 包含增量文本与警告日志
