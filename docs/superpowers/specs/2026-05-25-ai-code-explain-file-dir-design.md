# AI Code Explain `--file` / `--dir` 设计说明

## 目标

扩展 `projects/01-ai-code-explain`，让 `cli.ts` 和 `cli-openai.ts` 都支持：

- `--file <path>`：分析单个文档或代码文件
- `--dir <path>`：分析整个目录

两个 CLI 必须保持相同的参数行为和相同的 JSON 输出结构。

## 范围

本次改动包含：

- 共享的 CLI 参数解析
- 共享的文件与目录加载逻辑
- 共享的输出结构定义
- 目录模式下的聚合分析行为
- 参数解析、文件收集和结果封装的测试

本次改动不包含：

- 目录汇总过程中的 streaming 增量输出，仅保留现有 OpenAI CLI 的文件分析 streaming 能力
- 超长文件的高级截断或摘要策略
- 并行发起多个模型请求
- CLI 自定义 include / exclude glob

## 面向用户的行为

### 文件模式

支持的调用方式：

```bash
npx tsx cli.ts --file ./docs/activity-config.md "这个字段怎么配置？"
npx tsx cli-openai.ts --file ./docs/activity-config.md "这个字段怎么配置？"
```

兼容行为：

- 如果没有传 flag，继续保持旧行为，把第一个位置参数当作文件路径

输出结构：

```json
{
  "mode": "file",
  "target": "./docs/activity-config.md",
  "result": {
    "summary": "...",
    "dependencies": [],
    "components": [],
    "risks": []
  }
}
```

### 目录模式

支持的调用方式：

```bash
npx tsx cli.ts --dir ./src/utils "找出所有工具函数的作用"
npx tsx cli-openai.ts --dir ./src/utils "找出所有工具函数的作用"
```

输出结构：

```json
{
  "mode": "dir",
  "target": "./src/utils",
  "summary": "...",
  "files": [
    {
      "path": "a.ts",
      "result": {
        "summary": "...",
        "dependencies": [],
        "components": [],
        "risks": []
      }
    }
  ]
}
```

## 目录扫描规则

- 递归遍历目标目录
- 只包含文本型源码和文档文件：
  - `.ts`、`.tsx`、`.js`、`.jsx`、`.mjs`、`.cjs`、`.json`、`.md`
- 跳过：
  - `node_modules`
  - 隐藏目录和隐藏文件
  - 非文件节点
- 输出中的文件路径相对于目录目标路径保存

## Prompt 策略

### 文件模式

继续使用现有的单文件分析 prompt，但允许额外附带一个可选的用户问题。

### 目录模式

采用两步方案：

1. 先逐个文件独立分析，沿用现有单文件分析 prompt
2. 再基于逐文件分析结果和用户原始问题，额外生成一次目录级 summary

这样可以让单文件结果保持稳定，也避免把整个目录源码一次性塞进一个 prompt。

## 错误处理

- `--file` 和 `--dir` 互斥
- 如果两个都没传：
  - 保留当前“位置参数即文件路径”的旧行为
- 如果目标路径无法读取：
  - 抛出包含失败路径的明确错误
- 如果 `--dir` 最终没有找到任何支持分析的文件：
  - 抛出明确错误
- 如果匹配到的文件内容为空：
  - 第一版直接让本次运行失败，而不是静默跳过

## 内部设计

在 `src/` 下新增共享工具，负责：

- 参数解析
- 文件目标读取
- 目录文件收集
- 构建目录 summary prompt

CLI 入口文件保持尽量薄：

- 解析参数
- 校验环境变量
- 分发到 file 或 dir 模式
- 打印稳定 JSON

Anthropic 与 OpenAI analyzer 的差异尽量限制在传输层和 streaming 支持上。

## 测试

补充以下测试：

- 参数解析
- 无 flag 时的文件模式兼容行为
- 目录文件收集与过滤规则
- 相对路径输出
- file / dir 模式的输出包裹结构

涉及模型调用的测试应在 orchestration 层做 mock，保证测试本地可跑且结果稳定。

## 风险

- 目录模式会对每个文件发起一次模型调用，并额外再做一次目录汇总调用，因此目录越大延迟越高
- 第一版还没有解决超长文件截断问题
- 严格要求空文件报错，逻辑更简单，但在混合内容目录里可能会有点吵
