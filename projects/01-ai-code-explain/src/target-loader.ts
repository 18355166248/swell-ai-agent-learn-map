import { readFileSync, readdirSync, statSync, type Dirent } from "node:fs";
import { relative, resolve, sep } from "node:path";

/** 支持分析的文件扩展名 */
const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
]);

/** 已加载的文件信息 */
export interface LoadedFile {
  /** 文件绝对路径 */
  absolutePath: string;
  /** 相对于目标目录的路径 */
  relativePath: string;
  /** 文件文本内容 */
  content: string;
}

/** 判断是否为隐藏文件/目录（以 . 开头） */
function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}

/** 判断目录遍历时是否应跳过该条目（node_modules、隐藏文件/目录） */
function shouldSkipDirent(dirent: Dirent): boolean {
  return dirent.name === "node_modules" || isHiddenName(dirent.name);
}

/** 读取单个目标文件的内容 */
export function readTargetFile(filePath: string): string {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, "utf-8");

  if (!content.trim()) {
    throw new Error(`文件 ${filePath} 内容为空`);
  }

  return content;
}

/**
 * 递归收集目录下所有支持的文件
 * 自动跳过 node_modules、隐藏文件/目录、不支持的文件扩展名
 * 结果按相对路径字母排序
 */
export function collectDirectoryFiles(dirPath: string): LoadedFile[] {
  const root = resolve(dirPath);

  if (!statSync(root).isDirectory()) {
    throw new Error(`${dirPath} 不是目录`);
  }

  const files: LoadedFile[] = [];

  function walk(currentPath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (shouldSkipDirent(entry)) {
        continue;
      }

      const nextPath = resolve(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(nextPath);
        continue;
      }

      if (!entry.isFile() || isHiddenName(entry.name)) {
        continue;
      }

      const extension = entry.name.slice(entry.name.lastIndexOf("."));
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        continue;
      }

      const content = readFileSync(nextPath, "utf-8");
      if (!content.trim()) {
        throw new Error(`文件 ${nextPath} 内容为空`);
      }

      files.push({
        absolutePath: nextPath,
        relativePath: relative(root, nextPath).split(sep).join("/"),
        content,
      });
    }
  }

  walk(root);

  if (files.length === 0) {
    throw new Error(`目录中没有可分析的文件: ${dirPath}`);
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
