# 项目 03：需求分析助手

> 对应学习周次：Week 6
> 当前状态：v1 已完成，支持结构化需求分析输出

## 功能

输入一段需求描述，AI 结合内部规范文档自动输出结构化分析：

- 页面改动点
- 接口依赖（已有/新增）
- 埋点需求（page_view / click / exposure / biz_event）
- 组件依赖
- 风险点 + 缓解措施
- 测试建议 + 优先级

## 快速开始

```bash
cd projects/03-req-analyst
npm install
npm run index    # 索引知识库文档
npm start        # 启动服务 http://localhost:8082
```

## 技术架构

```
用户需求文本
  → Query 改写（关键词扩展）
  → 混合检索（向量 + BM25 → RRF 融合）
  → 检索到的规范文档 chunk + 需求文本
  → LLM 结构化分析（JSON 输出，response_format: json_object）
  → 前端卡片式展示
```

## 知识库文档

| 文档              | 内容                   |
| ----------------- | ---------------------- |
| component-spec.md | 移动端组件库清单与用法 |
| tracking-spec.md  | 埋点规范与自查清单     |
| api-spec.md       | 接口通用格式与常用接口 |
| payment-flow.md   | 支付业务流程与安全规范 |
| release-flow.md   | 发布上线流程与灰度策略 |

## API

```
POST /api/analyze
Body: { "requirement": "需求描述文本" }
Response: { pageChanges[], apiDependencies[], trackingRequirements[], componentDependencies[], risks[], testSuggestions[] }
```

## 目录结构

```text
03-req-analyst/
├── src/
│   ├── analyst.ts        # 核心分析逻辑 + 结构化 Prompt
│   ├── server.ts         # Express Web 服务
│   └── index.ts          # 文档索引脚本
├── public/
│   └── index.html        # Web UI（输入需求 + 卡片式展示结果）
├── docs/
│   └── knowledge-base/   # 5 个内部规范文档
│       ├── component-spec.md
│       ├── tracking-spec.md
│       ├── api-spec.md
│       ├── payment-flow.md
│       └── release-flow.md
├── .data/
│   └── vectors.json      # 向量索引（自动生成）
└── package.json
```

## 迭代计划

| 版本 | 功能                                | 对应周    |
| ---- | ----------------------------------- | --------- |
| v1   | 结构化需求分析输出                  | Week 6 ✅ |
| v2   | 集成到 dev-copilot，作为 Agent 工具 | Week 7 ⬜ |
