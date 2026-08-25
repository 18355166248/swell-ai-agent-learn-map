import { readdirSync, statSync } from "fs";
import { resolve, relative, join } from "path";
import { safePath } from "./pathSafety.js";

const SKIP_DIRS = new Set(["node_modules", ".git", ".data", "dist", "__pycache__"]);

function matchPattern(path: string, pattern?: string): boolean {
  if (!pattern) return true;

  const p = pattern.replace(/\\/g, "/");
  const normalizedPath = path.replace(/\\/g, "/");

  if (p.includes("**")) {
    const [prefix, suffix = ""] = p.split("**");
    const normalizedPrefix = prefix.replace(/\/$/, "");
    const normalizedSuffix = suffix.replace(/^\//, "").replace(/^\*\./, ".");

    return normalizedPath.startsWith(normalizedPrefix) && normalizedPath.endsWith(normalizedSuffix);
  }

  if (p.startsWith("*.")) {
    const ext = p.slice(1);
    return normalizedPath.endsWith(ext);
  }

  return normalizedPath.includes(p);
}

function walkDir(dir: string, pattern?: string, maxEntries = 200): string[] {
  const results: string[] = [];
  const root = resolve(dir);

  function walk(current: string) {
    if (results.length >= maxEntries) return;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxEntries) return;
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;

      const full = join(current, entry.name);
      const relPath = relative(root, full).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (!pattern) results.push(`${relPath}/`);
        walk(full);
      } else if (matchPattern(relPath, pattern)) {
        try {
          const size = statSync(full).size;
          const sizeStr = size < 1024 ? `${size}B` : `${(size / 1024).toFixed(1)}KB`;
          results.push(`${relPath}  (${sizeStr})`);
        } catch {
          results.push(relPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

export async function listFiles(
  args: { dir?: string; pattern?: string },
  projectRoot: string,
): Promise<string> {
  const targetDir = args.dir ? safePath(args.dir, projectRoot) : projectRoot;

  try {
    statSync(targetDir);
  } catch {
    return `目录不存在: ${args.dir || "."}`;
  }

  const entries = walkDir(targetDir, args.pattern);

  if (entries.length === 0) {
    const filter = args.pattern ? ` (过滤: ${args.pattern})` : "";
    return `目录为空${filter}: ${args.dir || "."}`;
  }

  const header = `共 ${entries.length} 个条目${args.pattern ? ` (过滤: ${args.pattern})` : ""}:`;
  return [header, ...entries].join("\n");
}
