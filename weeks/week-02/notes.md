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

```
TODO：记录 token 计算方法和踩坑
```

## 长文档处理策略

```
TODO：记录你选择的策略和原因
```

## 踩坑记录

- CLI 的实时展示和最终 JSON 输出必须分流，否则一旦把流式文本打到 `stdout`，最终结果就不再是合法 JSON
- 不能把“看到流式文本”当成完成条件，仍然要对最终完整文本做一次统一 JSON 解析和兜底

## 下周要带走的问题
