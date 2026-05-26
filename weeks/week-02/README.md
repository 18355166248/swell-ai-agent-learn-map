# Week 2：LLM API 进阶 + 文件问答

**时间**：2026-05-28 – 2026-06-03
**状态**：✅ 完成

## 本周目标

> 把上周的 CLI 升级：支持读取文档文件，处理长文本，流式输出。

## 要学的概念

- [ ] Streaming（流式输出）的实现方式
- [ ] Token 计算：tiktoken / 手估 / 模型报错时如何处理
- [ ] 上下文窗口限制：超出时如何截断或摘要
- [ ] 错误处理：rate limit、timeout、context too long 怎么应对
- [ ] 多轮对话的消息格式（messages 数组）

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
