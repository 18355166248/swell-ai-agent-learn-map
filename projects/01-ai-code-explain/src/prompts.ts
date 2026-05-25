export const SYSTEM_PROMPT = `你是一个前端代码分析助手。
你的任务是阅读输入的前端代码文件，输出结构化的 JSON 分析结果。

要求：
1. 只返回合法的 JSON，不要输出 Markdown，不要添加解释性前缀
2. 不要编造不存在的接口、组件或依赖
3. 如果某项没有内容，返回空数组 []
4. 字段名必须稳定，使用英文`;

/** 构建单文件分析 prompt 的输入参数 */
export interface AnalysisInput {
  /** 文件路径（用于在 prompt 中展示） */
  filePath: string;
  /** 文件原始内容 */
  fileContent: string;
  /** 用户可选的自定义问题 */
  question?: string;
}

/** 构建单文件分析的用户 prompt */
export function buildUserPrompt(input: AnalysisInput): string {
  const questionBlock = input.question ? `\n用户问题：\n${input.question}\n` : "";

  return `请分析下面这个文件，重点关注：
1. 这个文件做了什么
2. 它依赖了哪些接口或外部能力（API、hook、store、工具函数等）
3. 它渲染或导出了哪些主要组件
4. 是否存在潜在风险（异常处理缺失、边界情况、性能问题等）${questionBlock}

文件路径：
${input.filePath}

文件内容：
\`\`\`
${input.fileContent}
\`\`\`

请严格返回 JSON，字段为 summary、dependencies、components、risks。`;
}

/** 构建目录总结 prompt 的输入参数 */
export interface DirectorySummaryInput {
  dirPath: string;
  question?: string;
  files: Array<{
    path: string;
    result: {
      summary: string;
      dependencies: string[];
      components: string[];
      risks: string[];
    };
  }>;
}

/** 构建目录整体总结的 prompt */
export function buildDirectorySummaryPrompt(input: DirectorySummaryInput): string {
  return `请基于下面这些文件分析结果，总结目录的整体职责、主要工具能力和共性风险。

目录路径：
${input.dirPath}

用户问题：
${input.question || "请概括这个目录"}

逐文件结果：
\`\`\`json
${JSON.stringify(input.files, null, 2)}
\`\`\`

请只返回一个简洁的中文 summary 文本。`;
}
