# 学习进度追踪

> 每周至少更新一次。这里记录“真实完成情况”，不是计划复制。

## 更新约定

- 状态只反映实际进展：`✅ 完成` / `🟡 进行中` / `⬜ 未开始` / `❌ 延期`
- 只有实际做完的事项才勾选
- 如果当周还没开工，可以明确写“尚未开始”，不要保留模糊状态

## 当前快照

- 更新时间：2026-05-29
- 当前阶段：Week 8 进行中
- 本周已完成：Week 7 验收收口 + 文档同步 + Week 8 分享材料启动
- 当前重点：8 周学习总结 + 技术分享网页 PPT + 最终项目整合

## 总体进度

| 周次   | 时间        | 主题                    | 状态      | 项目产出           |
| ------ | ----------- | ----------------------- | --------- | ------------------ |
| Week 1 | 05/21–05/27 | Prompt 基础 + LLM API   | ✅ 完成   | ai-code-explain v1 |
| Week 2 | 05/28–06/03 | LLM API 进阶 + 文件问答 | ✅ 完成   | ai-code-explain v2 |
| Week 3 | 06/04–06/10 | Embedding + 向量检索    | ✅ 完成   | doc-rag 核心模块   |
| Week 4 | 06/11–06/17 | RAG 完整 Demo           | ✅ 完成   | doc-rag Web 服务   |
| Week 5 | 06/18–06/24 | RAG 效果优化            | ✅ 完成   | BM25 + 混合检索    |
| Week 6 | 06/25–07/01 | 接入真实场景            | ✅ 完成   | req-analyst v1     |
| Week 7 | 07/02–07/08 | Agent + 工具调用        | ✅ 完成   | dev-copilot v1     |
| Week 8 | 07/09–07/15 | 整合收尾                | 🟡 进行中 | dev-copilot 完整版 |

状态说明：✅ 完成 | 🟡 进行中 | ⬜ 未开始 | ❌ 延期

---

## Week 1（05/21–05/27）

### 完成情况

- [x] 初始化学习仓库结构（weeks / projects / experiments / docs / shared）
- [x] 拆分 8 周路线图和每周主题
- [x] 建立项目 README、实验模板和进度模板
- [x] 补齐 Week 1 学习笔记初稿
- [x] 理解 System Prompt / User Prompt
- [x] 掌握 JSON 输出约束
- [x] 了解 Function Calling 概念
- [x] 知道 Temperature / max_tokens 的作用
- [x] 完成 ai-code-explain CLI v1
- [x] 根仓库测试通过（`npm test`）
- [x] `projects/01-ai-code-explain` 构建通过（`npm run build`）
- [x] 命令行入口本地可执行（基于 `dist/cli.js` 验证到真实请求前一步）
- [x] 用真实文件完成一次外部模型端到端验证

### 本周笔记

> 见 `weeks/week-01/notes.md`

### 踩坑记录

- 当前文档不能把“可编译/可测试”直接写成“真实模型已跑通”，两者是不同层级的验证
- Codex 当前执行环境禁止我直接把工作区源码发送到外部模型服务，所以端到端实跑最终改为用户在本机终端补做
- 后续每次补实现时，需要同步更新项目 README 和本页状态，避免信息失真

### 下周计划预览

- streaming 输出
- 长文档处理
- 支持 --file 参数

---

## Week 2（05/28–06/03）

### 完成情况

- [x] streaming 流式输出
- [x] token 计算和上下文窗口
- [x] 长文档处理（截断/摘要）
- [x] 错误处理和重试
- [x] 完成 ai-code-explain v2（支持 --file 和 --dir）

### 本周笔记

> 见 `weeks/week-02/notes.md`

### 踩坑记录

> 开始后补充。

---

## Week 3（06/04–06/10）

### 完成情况

- [x] 用 Embedding API 向量化文本
- [x] 手写 Cosine Similarity
- [x] 实现文档切分（Markdown 按标题切分）
- [x] 批量 embedding 并存到 JSON
- [x] 实现最基础的向量检索
- [x] doc-rag 核心模块完成（chunker / embedder / retriever）

### 本周笔记

> 见 `weeks/week-03/notes.md`

---

## Week 4（06/11–06/17）

### 完成情况

- [x] 完整 RAG Pipeline
- [x] 引用来源展示
- [x] 基础 Web UI
- [x] Express 服务 + 文件上传
- [x] 端到端测试通过

### 本周笔记

> 见 `weeks/week-04/notes.md`

---

## Week 5（06/18–06/24）

### 完成情况

- [x] 建立评估数据集
- [x] 对比 3 种 Chunk 策略
- [x] 实现 Query 改写（默认启用）
- [x] 实现 BM25 关键词搜索
- [x] 实现混合检索（RRF 融合）
- [x] 最优策略回填进项目

### 实验结论

> 见 `experiments/chunk-strategies/README.md`

---

## Week 6（06/25–07/01）

### 完成情况

- [x] 收集并整理真实文档（5 个规范：组件库/埋点/接口/支付/发布）
- [x] 建立文档索引
- [x] 完成需求分析 Prompt 设计（6 维度结构化输出）
- [x] 结构化输出实现（JSON 格式）
- [x] Express 服务 + Web UI（3 个预设示例）
- [x] 真实需求测试 ≥ 3 个

---

## Week 7（07/02–07/08）

### 完成情况

- [x] Agent ReAct 循环（OpenAI function calling）
- [x] read_file 工具（路径安全 + 行号切片 + 二进制检测）
- [x] list_files 工具（递归 + pattern 过滤）
- [x] search_code 工具（关键词搜索代码文件）
- [x] grep 工具（正则表达式搜索 + 上下文行）
- [x] search_docs 工具（RAG 混合检索 + 合并多向量库）
- [x] 工具注册表（map 模式 + 统一错误处理）
- [x] CLI 入口（彩色终端输出 + 参数解析）
- [x] Express 服务 + SSE 流式端点
- [x] 聊天式 Web UI（SSE 实时推理链展示）
- [x] 多工具组合 Agent 测试（search_code → grep → 分析）

### 本周笔记

> 见 `weeks/week-07/notes.md`

---

## Week 8（07/09–07/15）

### 完成情况

- [ ] 功能整合完毕
- [ ] README 和使用文档
- [x] 学习总结文档（初稿）
- [x] 技术分享材料（网页 PPT 初版）

### 本周笔记

> 见 `weeks/week-08/notes.md`

---

## 关键指标

| 指标           | 目标          | 当前 |
| -------------- | ------------- | ---- |
| 周产出 Demo 数 | 每周至少 1 个 | 1    |
| 笔记篇数       | 每周 1 篇     | 1    |
| 实验记录       | ≥ 3 组对比    | 0    |
| 最终项目能力点 | 6 项          | 0    |

## 下次更新时要同步检查

- `README.md` 的当前阶段是否仍然准确
- 对应周的 `notes.md` 是否已经补内容
- 项目 README 中的命令是否已经能真实执行
