import type { AnalysisResult } from "./analysis-result.js";
import type { CliOptions } from "./cli-options.js";
import type { LoadedFile } from "./target-loader.js";
import type { CliEnvelope, DirectoryFileResult } from "./types.js";

/** runAnalysis 的外部依赖注入接口 */
interface RunAnalysisDeps {
  /** 读取单个文件内容 */
  readTargetFile: (filePath: string) => string;
  /** 收集目录下的所有文件 */
  collectDirectoryFiles: (dirPath: string) => LoadedFile[];
  /** 分析单个文件内容 */
  analyzeContent: (
    filePath: string,
    fileContent: string,
    question?: string,
  ) => Promise<AnalysisResult>;
  /** 对目录整体做总结 */
  summarizeDirectory: (
    dirPath: string,
    files: DirectoryFileResult[],
    question?: string,
  ) => Promise<string>;
}

/**
 * 核心分析流程编排：
 * - 文件模式：读取文件 → 分析 → 返回 FileEnvelope
 * - 目录模式：收集文件 → 逐个分析 → 目录总结 → 返回 DirectoryEnvelope
 */
export async function runAnalysis(
  options: CliOptions,
  deps: RunAnalysisDeps,
): Promise<CliEnvelope> {
  if (options.mode === "file") {
    const content = deps.readTargetFile(options.target);
    const result = await deps.analyzeContent(options.target, content, options.question);

    return {
      mode: "file",
      target: options.target,
      result,
    };
  }

  const loadedFiles = deps.collectDirectoryFiles(options.target);
  const files: DirectoryFileResult[] = [];

  for (const file of loadedFiles) {
    const result = await deps.analyzeContent(file.relativePath, file.content, options.question);
    files.push({
      path: file.relativePath,
      result,
    });
  }

  const summary = await deps.summarizeDirectory(options.target, files, options.question);

  return {
    mode: "dir",
    target: options.target,
    summary,
    files,
  };
}
