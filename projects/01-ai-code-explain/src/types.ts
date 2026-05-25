import type { AnalysisResult } from "./analysis-result.js";

/** 目录模式下单个文件的分析结果 */
export interface DirectoryFileResult {
  /** 文件相对路径 */
  path: string;
  /** 该文件的分析结果 */
  result: AnalysisResult;
}

/** 单文件模式的分析输出信封 */
export interface FileEnvelope {
  mode: "file";
  /** 分析目标文件路径 */
  target: string;
  /** 文件分析结果 */
  result: AnalysisResult;
}

/** 目录模式的分析输出信封 */
export interface DirectoryEnvelope {
  mode: "dir";
  /** 分析目标目录路径 */
  target: string;
  /** 目录整体总结 */
  summary: string;
  /** 目录下各文件的分析结果 */
  files: DirectoryFileResult[];
}

/** CLI 最终输出的联合类型：文件模式或目录模式 */
export type CliEnvelope = FileEnvelope | DirectoryEnvelope;
