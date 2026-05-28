import { readFileSync, statSync } from "fs";
import { safePath } from "./pathSafety.js";

function isBinary(path: string): boolean {
  const buffer = readFileSync(path);
  for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export async function readFile(
  args: { path: string; startLine?: number; endLine?: number },
  projectRoot: string,
): Promise<string> {
  const fullPath = safePath(args.path, projectRoot);

  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(fullPath);
  } catch {
    return `文件不存在: ${args.path}`;
  }

  if (stats.isDirectory()) {
    return `路径是一个目录，请使用 list_files 查看内容: ${args.path}`;
  }

  if (stats.size > 100 * 1024) {
    return `文件过大 (${(stats.size / 1024).toFixed(1)} KB)，请指定 startLine/endLine 读取部分内容`;
  }

  if (isBinary(fullPath)) {
    return "[二进制文件，无法以文本形式展示]";
  }

  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  const start = Math.max(1, args.startLine ?? 1);
  const end = Math.min(lines.length, args.endLine ?? lines.length);

  if (start > lines.length) {
    return `文件只有 ${lines.length} 行，起始行 ${start} 超出范围`;
  }

  return lines
    .slice(start - 1, end)
    .map((line, i) => `${start + i}: ${line}`)
    .join("\n");
}
