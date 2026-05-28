import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { safePath } from "./pathSafety.js";

const SEARCH_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".html",
  ".css",
  ".scss",
]);
const SKIP_DIRS = new Set(["node_modules", ".git", ".data", "dist", "__pycache__"]);

export async function searchCode(
  args: { query: string; dir?: string },
  projectRoot: string,
): Promise<string> {
  const targetDir = args.dir ? safePath(args.dir, projectRoot) : projectRoot;
  const query = args.query.toLowerCase();

  const matches: { file: string; line: number; content: string; matchCount: number }[] = [];

  function searchIn(entryPath: string, filePath: string) {
    let content: string;
    try {
      const stats = statSync(filePath);
      if (stats.size > 200 * 1024) return; // skip files > 200KB
      content = readFileSync(filePath, "utf-8");
    } catch {
      return;
    }

    const lines = content.split("\n");
    let fileMatches = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(query)) {
        if (matches.length < 30) {
          matches.push({
            file: entryPath,
            line: i + 1,
            content: lines[i].trim().slice(0, 200),
            matchCount: 0,
          });
        }
        fileMatches++;
      }
    }
    // 更新匹配计数
    for (let j = matches.length - 1; j >= 0 && matches[j].file === entryPath; j--) {
      matches[j].matchCount = fileMatches;
    }
  }

  function walk(current: string) {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;

      const full = join(current, entry.name);
      const relPath = full
        .slice(projectRoot.length)
        .replace(/^[\\/]/, "")
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (matches.length >= 30) return;
        walk(full);
      } else if (
        SEARCH_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase())
      ) {
        if (matches.length >= 30) return;
        searchIn(relPath, full);
      }
    }
  }

  walk(targetDir);

  if (matches.length === 0) {
    return `未找到包含 "${args.query}" 的代码`;
  }

  // 按文件聚合，按每文件匹配数降序
  const byFile = new Map<string, typeof matches>();
  for (const m of matches) {
    const arr = byFile.get(m.file) || [];
    arr.push(m);
    byFile.set(m.file, arr);
  }

  const result: string[] = [];
  const sorted = [...byFile.entries()].sort((a, b) => b[1][0].matchCount - a[1][0].matchCount);

  for (const [file, fileMatches] of sorted) {
    result.push(`\n${file} (${fileMatches[0].matchCount} 处匹配):`);
    for (const m of fileMatches.slice(0, 5)) {
      result.push(`  ${m.line}: ${m.content}`);
    }
  }
  result.push(`\n共 ${matches.length} 条结果`);

  return result.join("\n");
}
