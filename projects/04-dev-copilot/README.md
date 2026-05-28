# 项目 04：AI Dev Copilot — 前端研发知识库助手

> 对应学习周次：Week 7–8
> 当前状态：**v1 已完成** — Agent + 5 工具 + CLI + Web UI

## 这是什么

一个 ReAct Agent，通过自主调用只读工具来帮助开发者分析项目和文档。

```
你：分析这个项目有哪些 Express 服务

Agent：
  [调用 list_files]  查看项目目录结构
  [调用 search_code] 搜索 server.ts 文件
  [调用 read_file]   读取服务器配置
  [分析]             输出: 3 个 Express 服务 (8081/8082/8083)
```

## 核心能力（v1 已完成）

| 能力           | 工具                                      | 状态 |
| -------------- | ----------------------------------------- | ---- |
| 浏览项目结构   | `list_files` — 列出目录、支持模式过滤     | ✅   |
| 读取文件内容   | `read_file` — 行号切片、路径安全          | ✅   |
| 关键词搜索代码 | `search_code` — 搜索 .ts/.tsx/.js 等      | ✅   |
| 正则表达式搜索 | `grep` — 支持上下文行                     | ✅   |
| 语义文档检索   | `search_docs` — RAG 混合检索（向量+BM25） | ✅   |
| 多步推理       | Agent ReAct 循环 — 自动工具调用链         | ✅   |
| CLI 入口       | `tsx cli.ts "任务"` — 终端彩色输出        | ✅   |
| Web 界面       | Express + SSE 流式 — 聊天式 UI            | ✅   |
| 自动化测试     | Vitest — 路径安全 / glob / Agent 轮次语义 | ✅   |

## 快速开始

```bash
cd projects/04-dev-copilot

# CLI 模式
npx tsx cli.ts "分析这个项目有哪些工具函数"
npx tsx cli.ts --model openai/gpt-4o "搜索埋点相关代码"

# Web 模式
npx tsx src/server.ts        # 启动 → http://localhost:8083
```

## 技术架构

```
cli.ts / Web UI
    │
    └── runAgent() — ReAct 循环
         │
    ┌────┴────┐
    │  OpenAI  │  function calling
    │  Chat    │  (支持 OpenRouter)
    └────┬────┘
         │
    ┌────┴────────────┐
    │  Tool Registry  │
    │  5 只读工具      │
    └────┬────────────┘
         │
    ┌────┴─────────────────────────┐
    │  fs / doc-rag workspace 包    │
    └──────────────────────────────┘
```

## Agent 循环（ReAct 模式）

```
用户任务 → messages[system, user]
  while (迭代 < 10):
    response = LLM(messages, tools)
    if 最终答案 → 返回
    if tool_calls:
      执行工具 → 追加 tool results
      继续循环
  → 强制总结
```

## 目录结构

```text
04-dev-copilot/
├── cli.ts                       # CLI 入口
├── package.json
├── tsconfig.json
├── src/
│   ├── agent/
│   │   ├── index.ts             # Agent 主循环 (ReAct)
│   │   ├── prompts.ts           # 系统 Prompt
│   │   └── tools/
│   │       ├── registry.ts      # 工具注册表
│   │       ├── readFile.ts      # 读文件 (路径安全 + 行号切片)
│   │       ├── listFiles.ts     # 列目录 (递归 + pattern 过滤)
│   │       ├── searchCode.ts    # 关键词搜索代码
│   │       ├── searchDocs.ts    # RAG 文档检索 (合并多向量库)
│   │       └── grep.ts          # 正则搜索 (上下文行)
│   └── server.ts                # Express + SSE 流式
├── public/
│   └── index.html               # 聊天式 Web UI
└── .data/                       # 向量索引（gitignore）
```

## API

```
POST /api/agent
Body: { "task": "任务描述" }
Response: { answer, steps[], iterations }

GET /api/agent/stream?task=...
SSE events: step / result / answer / done / error
说明: 当前流式事件展示的是工具执行轨迹和最终答案，不暴露模型原始思维链

GET /api/health
Response: { "status": "ok" }
```

## 复用模块

| 来源             | 模块                     | 用途                        |
| ---------------- | ------------------------ | --------------------------- |
| `02-doc-rag`     | `doc-rag` workspace 导出 | 对外暴露检索与 RAG 公共接口 |
| `03-req-analyst` | 知识库文档               | 5 个规范文档的向量索引      |

## 已知限制

- **免费模型** `openai/gpt-oss-120b:free` 偶尔不调用工具直接回答，换成 `gpt-4o` 效果显著提升
- `search_docs` 合并了两个向量库（02 + 03），不区分来源项目
- `search_docs` 通过 `doc-rag` workspace 包复用能力，但向量索引仍来自 02 / 03 两个项目

## 迭代计划

| 版本 | 功能                                     | 对应周 | 状态 |
| ---- | ---------------------------------------- | ------ | ---- |
| v1   | 5 个只读工具 + Agent 循环 + CLI + Web UI | Week 7 | ✅   |
| v2   | 功能整合 + Prompt 调优 + 技术分享版本    | Week 8 | ⬜   |
