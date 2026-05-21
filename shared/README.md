# 跨项目共用代码

> 把各项目中重复的代码提取到这里，减少复制粘贴。

## 目录

```
shared/
├── llm/
│   └── client.ts       # OpenAI 客户端封装（含重试、错误处理）
├── embedding/
│   └── embedder.ts     # Embedding 调用封装（含批量处理）
└── utils/
    ├── chunker.ts      # 文档切分工具
    ├── similarity.ts   # Cosine Similarity 计算
    └── fileReader.ts   # 文件读取工具
```

## 使用方式

```typescript
// 在各项目中引用
import { createClient } from "../../shared/llm/client";
import { embed, embedBatch } from "../../shared/embedding/embedder";
import { chunkByHeading } from "../../shared/utils/chunker";
```

## 注意

这里只放**稳定的、跨项目通用的**工具函数。
项目特有的逻辑放在各自的 `src/` 目录下。
