# Week 7：Agent + 工具调用

**时间**：2026-07-02 – 2026-07-08
**状态**：⬜ 未开始

## 本周目标

> RAG 让 AI "知道"，Agent 让 AI "去做"。实现多工具组合的自动任务拆解。

## RAG vs Agent 的区别

```
RAG：  用户问 → 检索 → 模型回答（一次性）
Agent：用户任务 → 模型拆解 → 调用工具 → 观察结果 → 继续拆解 → 最终答案（循环）
```

## Tool Calling 机制

```
1. 定义工具（名称、描述、参数 schema）
2. 把工具列表发给模型
3. 模型决定调用哪个工具（返回 tool_calls）
4. 你执行工具，把结果返回给模型
5. 模型继续推理或返回最终答案
```

## 实践项目

**`../../projects/04-dev-copilot/`**（第一版）

```bash
node cli.js "帮我分析这个需求需要改哪些文件"
```

**第一版只做只读工具，不要直接改代码（安全第一）**

工具集：
| 工具 | 功能 |
|------|------|
| `read_file(path)` | 读取文件内容 |
| `list_files(dir, pattern)` | 列出目录下的文件 |
| `search_code(query)` | 在代码文件中搜索关键词 |
| `search_docs(query)` | 查询内部文档知识库（接入 week-4 的 RAG） |
| `grep(pattern, dir)` | 正则搜索代码 |

## 每日安排

| 天   | 目标                                      | 完成？ |
| ---- | ----------------------------------------- | ------ |
| 周一 | 学 Tool Calling，写第一个工具 `read_file` | ⬜     |
| 周二 | 实现 `list_files` + `search_code`         | ⬜     |
| 周三 | 实现 `search_docs`（接入 RAG）            | ⬜     |
| 周四 | 实现多工具组合循环（ReAct 模式）          | ⬜     |
| 周五 | 端到端测试：输入需求 → Agent 自动分析     | ⬜     |
| 周末 | 完善，写本周总结                          | ⬜     |

## ReAct 循环模式

```
Thought: 我需要先了解项目结构
Action: list_files("./src")
Observation: [home/, order/, activity/, ...]

Thought: 需求涉及活动页，查看活动相关代码
Action: search_code("activity upload")
Observation: src/activity/hooks/useUpload.ts, ...

Thought: 再查规范文档
Action: search_docs("图片上传规范")
Observation: 需要压缩到 1MB 以下，使用 uploadImage SDK...

Final Answer: 需要修改以下文件...
```

## 产出 checklist

- [ ] `projects/04-dev-copilot/` 有 5 个工具实现
- [ ] Agent 能自主多步调用工具完成分析
- [ ] 有完整的推理过程输出（Thought/Action/Observation）
- [ ] `notes.md` 记录 Tool Calling 的核心实现
