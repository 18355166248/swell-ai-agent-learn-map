import { isAbsolute, relative, resolve } from "path";

export function safePath(target: string, projectRoot: string): string {
  const full = isAbsolute(target) ? resolve(target) : resolve(projectRoot, target);
  const root = resolve(projectRoot);
  const rel = relative(root, full);

  if (rel.startsWith("..") || rel === ".." || isAbsolute(rel)) {
    throw new Error(`禁止访问项目目录外的路径: ${target}`);
  }

  return full;
}
