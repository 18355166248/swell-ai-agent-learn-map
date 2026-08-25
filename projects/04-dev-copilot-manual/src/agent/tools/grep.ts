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

export async function grep(
  args: { pattern: string; dir?: string },
  projectRoot: string,
): Promise<string> {
  const targetDir = args.dir ? safePath(args.dir, projectRoot) : projectRoot;

  let regex: RegExp;
  try {
    regex = new RegExp(args.pattern, "gi");
  } catch (err: any) {
    return `无效的正则表达式: ${err.message}`;
  }

  const matches: { file: string; line: number; context: string }[] = [];

  function searchIn(entryPath: string, filePath: string) {
    let content: string;
    try {
      const stats = statSync(filePath);
      if (stats.size > 200 * 1024) return;
      content = readFileSync(filePath, "utf-8");
    } catch {
      return;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      // 重置 lastIndex（因为用了 g flag）
      regex.lastIndex = 0;
      if (regex.test(lines[i])) {
        if (matches.length < 30) {
          // 取上下文（前一行 + 匹配行 + 后一行）
          const ctxLines: string[] = [];
          if (i > 0) ctxLines.push(`  ${i}: ${lines[i - 1].trim().slice(0, 150)}`);
          ctxLines.push(`> ${i + 1}: ${lines[i].trim().slice(0, 200)}`);
          if (i < lines.length - 1)
            ctxLines.push(`  ${i + 2}: ${lines[i + 1].trim().slice(0, 150)}`);

          matches.push({
            file: entryPath,
            line: i + 1,
            context: ctxLines.join("\n"),
          });
        }
      }
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
    return `未找到匹配 "${args.pattern}" 的内容`;
  }

  // 按文件分组
  const byFile = new Map<string, typeof matches>();
  for (const m of matches) {
    const arr = byFile.get(m.file) || [];
    arr.push(m);
    byFile.set(m.file, arr);
  }

  const result: string[] = [];
  for (const [file, fileMatches] of byFile) {
    result.push(`\n${file}:`);
    for (const m of fileMatches) {
      result.push(m.context);
      result.push("");
    }
  }
  result.push(`共 ${matches.length} 条匹配`);

  return result.join("\n");
}
