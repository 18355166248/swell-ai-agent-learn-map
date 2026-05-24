# Week 1：Prompt 基础 + LLM API 初探

**时间**：2026-05-21 – 2026-05-27
**状态**：🟡 进行中

## 本周目标

> 搞清楚 AI 应用的数据流结构，做出第一个能跑的 CLI 工具。

```
用户输入 → Prompt 组织 → 模型调用 → 结果解析 → 输出
```

## 要学的概念

- [x] System Prompt vs User Prompt 的区别
- [x] JSON 输出约束（structured output / response_format）
- [x] Function Calling / Tool Calling 是什么（了解即可，第 7 周深入）
- [x] Temperature、max_tokens、context window 的意义
- [x] 如何用 OpenAI SDK 发起第一个请求

## 实践项目

**`../../projects/01-ai-code-explain/`**

```bash
# 目标效果
node cli.js ./src/pages/home/index.tsx
```

输出格式（JSON）：

```json
{
  "summary": "这个文件是首页组件，负责...",
  "dependencies": ["useUserInfo hook", "/api/home 接口"],
  "components": ["BannerSwiper", "ActivityCard"],
  "risks": ["未处理接口报错时的兜底状态"]
}
```

## 每日安排

| 天   | 目标                              | 完成？ |
| ---- | --------------------------------- | ------ |
| 周一 | 调通 OpenAI API，打印 Hello World | ✅     |
| 周二 | 写 System Prompt，实现代码总结    | ✅     |
| 周三 | 加 JSON 输出约束，结构化结果      | ✅     |
| 周四 | 接入 CLI：读取真实 .tsx 文件      | ✅     |
| 周五 | 打磨 Prompt，整理笔记             | ✅     |
| 周末 | CLI 完整测试 + 写本周总结         | ⬜     |

## 参考资源

- OpenAI Quickstart: https://platform.openai.com/docs/quickstart
- Prompt Engineering Guide: https://www.promptingguide.ai/zh
- OpenAI Node.js SDK: https://github.com/openai/openai-node

## 本周笔记

> 见 `notes.md`

## 产出 checklist

- [x] `projects/01-ai-code-explain/` 有可运行的 CLI
- [x] `notes.md` 记录了至少 3 个有价值的学习点
- [x] `PROGRESS.md` 已更新本周状态
