export const SYSTEM_PROMPT = `你是一个前端代码分析助手。
你的任务是阅读输入的前端代码文件，输出结构化的 JSON 分析结果。

要求：
1. 只返回合法的 JSON，不要输出 Markdown，不要添加解释性前缀
2. 不要编造不存在的接口、组件或依赖
3. 如果某项没有内容，返回空数组 []
4. 字段名必须稳定，使用英文`;

export interface AnalysisInput {
  filePath: string;
  fileContent: string;
}

export function buildUserPrompt(input: AnalysisInput): string {
  return `请分析下面这个文件，重点关注：
1. 这个文件做了什么
2. 它依赖了哪些接口或外部能力（API、hook、store、工具函数等）
3. 它渲染或导出了哪些主要组件
4. 是否存在潜在风险（异常处理缺失、边界情况、性能问题等）

文件路径：
${input.filePath}

文件内容：
\`\`\`
${input.fileContent}
\`\`\`

请严格返回 JSON，字段为 summary、dependencies、components、risks。`;
}
