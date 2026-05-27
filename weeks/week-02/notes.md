# Week 2 学习笔记

> 记录学到的东西、踩的坑、值得复用的代码片段。

## Streaming 实现

```typescript
const result = await analyzeFile(filePath, {
  onChunk: (chunk) => {
    process.stderr.write(chunk);
  },
});
```

当前实现结论：

- 先在 OpenAI 版 CLI 落 streaming，Anthropic 版暂时保持同步前的非 streaming 逻辑
- 增量内容打印到 `stderr`，最终结构化 JSON 仍然打印到 `stdout`
- 这样做的目的是避免“实时文本”和“最终 JSON”混在一起，导致下游命令行消费失败

这次实现里，`analyzer-openai.ts` 负责消费流式 chunk 并累积原始文本，CLI 只负责展示，不参与 JSON 解析。

## Token 计算

使用 `tiktoken`（cl100k_base 编码，兼容 GPT-4o 及大多数现代模型）进行精确 token 计数：

```typescript
import { encoding_for_model, get_encoding } from "tiktoken";

const encoder = encoding_for_model("gpt-4o");
const tokenCount = encoder.encode(text).length;
```

兜底方案：当 tiktoken 不可用时，用字符数估算。中文约 1 token/字，英文约 1 token/3.5 字符。

模型上下文窗口配置（`token-counter.ts`）：

- 128K: deepseek-v4-pro, gpt-oss, llama-3.3
- 262K: qwen3-coder
- 1M: deepseek-v4-flash

## 长文档处理策略

当前策略：**头尾保留 + 中间截断**

1. 计算可用 token 数 = 模型上下文限制 - system prompt(400) - prompt 模板(200) - max_tokens(2048) - 安全余量(1000)
2. 如果文件内容超出可用 token：
   - 保留头部 ~60% 的行
   - 保留尾部 ~30% 的行
   - 中间插入截断标记（含原始/截断后 token 数）
   - 通过 stderr 打印警告
3. 如果未超出限制，原样传递，无额外开销

选择"头尾保留"而非"纯截头"的原因：代码文件的 import/类型定义在文件头，核心逻辑/导出在文件尾，中间通常是具体实现，可以被省略。

## 错误处理与重试

采用指数退避 + 抖动（exponential backoff with jitter）：

```typescript
// 重试配置：最多 3 次，初始延时 1s
await withRetry(() => apiCall(), “context”, {
  maxRetries: 3,
  baseDelayMs: 1000,
});
```

重试决策逻辑（`retry.ts`）：

| 错误类型         | 重试？    | 原因               |
| ---------------- | --------- | ------------------ |
| 429 Rate Limit   | ✅ 重试   | 限流是临时的       |
| 5xx Server Error | ✅ 重试   | 服务端可能恢复     |
| Timeout/Network  | ✅ 重试   | 网络抖动           |
| overloaded_error | ✅ 重试   | Anthropic 过载     |
| 401/402/403      | ❌ 不重试 | 认证失败重试也没用 |

延时计算：`baseDelay * 2^attempt ± 25% jitter`，例如 1s → 2s → 4s。

Anthropic 和 OpenAI 分析器的 `analyzeFile`、`analyzeContent`、`summarizeDirectory` 都已接入 `withRetry`。

## 踩坑记录

- CLI 的实时展示和最终 JSON 输出必须分流，否则一旦把流式文本打到 `stdout`，最终结果就不再是合法 JSON
- 不能把”看到流式文本”当成完成条件，仍然要对最终完整文本做一次统一 JSON 解析和兜底
- tiktoken 的 `encoding_for_model()` 参数类型是 `TiktokenModel`（模型名如 “gpt-4o”），不是 `TiktokenEncoding`；直接用 encoding 名（如 “cl100k_base”）需要改用 `get_encoding()`
- 重试时 streaming 请求需要完全重新发起（不能从断点续传），所以重试粒度是整个 API 调用

## 下周要带走的问题
