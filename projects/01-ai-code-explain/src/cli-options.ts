/** CLI 解析后的选项 */
export interface CliOptions {
  /** 分析模式：单文件或目录 */
  mode: "file" | "dir";
  /** 分析目标路径 */
  target: string;
  /** 可选的用户自定义问题 */
  question?: string;
}

/**
 * 解析命令行参数，支持三种调用方式：
 * 1. 位置参数：npx tsx cli.ts <文件路径> [问题]
 * 2. --file 标志：npx tsx cli.ts --file <文件路径> [问题]
 * 3. --dir 标志：npx tsx cli.ts --dir <目录路径> [问题]
 */
export function parseCliOptions(args: string[]): CliOptions {
  const fileIdx = args.indexOf("--file");
  const dirIdx = args.indexOf("--dir");

  if (fileIdx !== -1 && dirIdx !== -1) {
    throw new Error("--file 和 --dir 不能同时使用");
  }

  if (fileIdx !== -1) {
    const target = args[fileIdx + 1];
    const question = args.slice(fileIdx + 2).join(" ").trim() || undefined;
    if (!target) {
      throw new Error("--file 后必须跟文件路径");
    }
    return { mode: "file", target, question };
  }

  if (dirIdx !== -1) {
    const target = args[dirIdx + 1];
    const question = args.slice(dirIdx + 2).join(" ").trim() || undefined;
    if (!target) {
      throw new Error("--dir 后必须跟目录路径");
    }
    return { mode: "dir", target, question };
  }

  const [target, ...rest] = args;
  if (!target) {
    throw new Error("缺少分析目标，请传入文件路径，或使用 --file / --dir");
  }

  return {
    mode: "file",
    target,
    question: rest.join(" ").trim() || undefined,
  };
}
