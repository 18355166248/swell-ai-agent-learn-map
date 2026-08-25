import { isAbsolute, relative, resolve, basename } from "path";

/**
 * 敏感文件/目录匹配规则
 * 即使路径在项目根目录内，匹配这些模式的文件也禁止访问
 */
const SENSITIVE_PATTERNS = [
  // .env 及其变体
  /(?:^|[\\/])\.env(?:\.\w+)?$/,
  // Git 目录
  /(?:^|[\\/])\.git(?:[\\/]|$)/,
  // 密钥/证书文件
  /\.(?:pem|key|p12|pfx|crt|cer)$/i,
  // 常见凭证文件名
  /(?:^|[\\/])(?:credentials|secrets|secret)\.(?:json|yaml|yml|toml|env)$/i,
  // node_modules 敏感配置
  /(?:^|[\\/])\.npmrc$/,
  /(?:^|[\\/])\.dockercfg$/,
] as const;

/** 检查目标路径是否命中敏感文件黑名单 */
function isSensitivePath(target: string): string | null {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(target)) {
      const name = basename(target);
      return `禁止访问敏感文件: ${name}（安全策略限制）`;
    }
  }
  // 额外检查：路径中任何一段名为 .env 的普通文件
  const segments = target.replace(/\\/g, "/").split("/");
  const lastSegment = segments[segments.length - 1] ?? "";
  if (/^\.env(\.\w+)?$/.test(lastSegment)) {
    return `禁止访问敏感文件: ${lastSegment}（安全策略限制）`;
  }
  return null;
}

export function safePath(target: string, projectRoot: string): string {
  const full = isAbsolute(target) ? resolve(target) : resolve(projectRoot, target);
  const root = resolve(projectRoot);
  const rel = relative(root, full);

  // 第一层：目录穿越检查
  if (rel.startsWith("..") || rel === ".." || isAbsolute(rel)) {
    throw new Error(`禁止访问项目目录外的路径: ${target}`);
  }

  // 第二层：敏感文件检查
  const sensitiveErr = isSensitivePath(full);
  if (sensitiveErr) {
    throw new Error(sensitiveErr);
  }

  return full;
}
