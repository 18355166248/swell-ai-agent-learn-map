import { readFileSync, statSync, openSync, readSync, closeSync, createReadStream } from "fs";
import { createInterface } from "readline";
import { safePath } from "./pathSafety.js";

function isBinary(path: string): boolean {
  let fd: number | undefined;
  try {
    fd = openSync(path, "r");
    const buffer = Buffer.alloc(1024);
    const bytesRead = readSync(fd, buffer, 0, 1024, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

async function readLineRange(path: string, start: number, end: number): Promise<string> {
  const rl = createInterface({
    input: createReadStream(path, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  const lines: string[] = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum >= start) {
      lines.push(`${lineNum}: ${line}`);
    }
    if (lineNum >= end) break;
  }

  if (lineNum < start) {
    return `文件只有 ${lineNum} 行，起始行 ${start} 超出范围`;
  }

  return lines.join("\n");
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

  if (isBinary(fullPath)) {
    return "[二进制文件，无法以文本形式展示]";
  }

  // 大文件必须同时指定 startLine 和 endLine，防止无上限读取
  if (stats.size > 100 * 1024 && args.endLine === undefined) {
    return `文件过大 (${(stats.size / 1024).toFixed(1)} KB)，请指定 startLine/endLine 读取部分内容`;
  }

  const start = Math.max(1, args.startLine ?? 1);

  // 指定了 endLine：流式读取，精确控制读取范围
  if (args.endLine !== undefined) {
    return readLineRange(fullPath, start, args.endLine);
  }

  // 小文件，无 endLine：readFileSync 全量读取（文件 ≤100KB）
  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  if (start > lines.length) {
    return `文件只有 ${lines.length} 行，起始行 ${start} 超出范围`;
  }

  return lines
    .slice(start - 1)
    .map((line, i) => `${start + i}: ${line}`)
    .join("\n");
}
