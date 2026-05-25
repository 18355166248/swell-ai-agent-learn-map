# AI Code Explain 文件与目录支持实现计划

> **给执行型 agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行本计划。步骤使用复选框 `- [ ]` 语法跟踪。

**目标：** 为 `cli.ts` 和 `cli-openai.ts` 增加共享的 `--file` 与 `--dir` 支持，并提供稳定的文件模式与目录模式 JSON 输出结构。

**架构：** 抽出共享的 CLI 参数解析、文件收集和运行编排逻辑到 `src/` 下，再让两个 CLI 入口只保留环境校验和轻量分发。目录模式先逐文件复用现有 analyzer 做分析，再基于收集到的逐文件结果额外生成一次目录级 summary。

**技术栈：** TypeScript、`tsx`、Node.js 文件系统与路径 API、现有 Anthropic/OpenAI SDK 封装、Vitest

---

## 文件结构

- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\package.json`
  - 增加测试脚本和 Vitest 开发依赖，让新增单测能通过 npm 执行
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\cli.ts`
  - 保留 env 引导和 Anthropic 专属校验，把主要流程委托给共享 runner
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\cli-openai.ts`
  - 保留 OpenAI 专属校验和 stream 处理，把主要流程委托给共享 runner
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\prompts.ts`
  - 支持可选用户问题，并新增目录 summary prompt 构建函数
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\analyzer.ts`
  - 拆分“读文件”和“调用 API”，并增加目录 summary API helper
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\analyzer-openai.ts`
  - 与 Anthropic 版做同样拆分，并增加目录 summary helper
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\cli-options.ts`
  - 解析 `--file`、`--dir`、旧的 positional fallback 和可选问题文本
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\target-loader.ts`
  - 递归收集支持的文件、过滤隐藏路径和 `node_modules`、读取单文件内容
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\run-analysis.ts`
  - 编排 file 模式和 dir 模式，并封装统一 JSON 输出
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\types.ts`
  - 放置共享的输出 envelope 类型
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\__tests__\cli-options.test.ts`
  - 覆盖参数解析和互斥错误
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\__tests__\target-loader.test.ts`
  - 覆盖目录递归、过滤、相对路径和空目录错误
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\__tests__\run-analysis.test.ts`
  - 用 mocked analyzer 覆盖 file / dir 输出 envelope
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\README.md`
  - 功能完成后补充新 CLI 用法文档

### 任务 1：补上本地测试执行能力

**文件：**
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\package.json`

- [ ] **步骤 1：先通过检查当前配置，写下失败预期**

当前 `package.json` 需要从：

```json
{
  "scripts": {
    "start": "tsx cli.ts",
    "build": "tsc",
    "dev": "tsx watch cli.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

改成包含测试脚本和 Vitest：

```json
{
  "scripts": {
    "start": "tsx cli.ts",
    "build": "tsc",
    "dev": "tsx watch cli.ts",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **步骤 2：运行命令，确认当前确实还不能跑测试**

运行：`npm run test`
预期：失败，提示缺少 `test` script

- [ ] **步骤 3：做最小 package manifest 修改**

```json
{
  "scripts": {
    "start": "tsx cli.ts",
    "build": "tsc",
    "dev": "tsx watch cli.ts",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **步骤 4：安装依赖并验证测试命令可以启动**

运行：`npm install`
预期：成功，`package-lock.json` 更新出 Vitest 依赖

运行：`npm run test`
预期：现有 prompt 和 analysis-result 测试通过

- [ ] **步骤 5：提交**

```bash
git add package.json package-lock.json
git commit -m "test: add vitest runner for ai-code-explain"
```

### 任务 2：增加共享 CLI 参数解析

**文件：**
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\cli-options.ts`
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\__tests__\cli-options.test.ts`

- [ ] **步骤 1：先写失败测试**

```ts
import { describe, expect, it } from "vitest";
import { parseCliOptions } from "../cli-options.js";

describe("parseCliOptions", () => {
  it("能解析带问题的 --file", () => {
    expect(parseCliOptions(["--file", "./docs/a.md", "这个字段怎么配置？"])).toEqual({
      mode: "file",
      target: "./docs/a.md",
      question: "这个字段怎么配置？",
    });
  });

  it("能解析带问题的 --dir", () => {
    expect(parseCliOptions(["--dir", "./src/utils", "找出所有工具函数的作用"])).toEqual({
      mode: "dir",
      target: "./src/utils",
      question: "找出所有工具函数的作用",
    });
  });

  it("保留旧的 positional file 兼容行为", () => {
    expect(parseCliOptions(["examples/sample.tsx"])).toEqual({
      mode: "file",
      target: "examples/sample.tsx",
      question: undefined,
    });
  });

  it("禁止同时使用 --file 和 --dir", () => {
    expect(() => parseCliOptions(["--file", "a.ts", "--dir", "src"])).toThrow(
      "--file 和 --dir 不能同时使用",
    );
  });
});
```

- [ ] **步骤 2：运行定向测试，确认它先失败**

运行：`npm run test -- src/__tests__/cli-options.test.ts`
预期：失败，提示找不到 `../cli-options.js`

- [ ] **步骤 3：写最小实现**

```ts
export interface CliOptions {
  mode: "file" | "dir";
  target: string;
  question?: string;
}

export function parseCliOptions(args: string[]): CliOptions {
  const fileIdx = args.indexOf("--file");
  const dirIdx = args.indexOf("--dir");

  if (fileIdx !== -1 && dirIdx !== -1) {
    throw new Error("--file 和 --dir 不能同时使用");
  }

  if (fileIdx !== -1) {
    const target = args[fileIdx + 1];
    const question = args.slice(fileIdx + 2).join(" ").trim() || undefined;
    if (!target) throw new Error("--file 后必须跟文件路径");
    return { mode: "file", target, question };
  }

  if (dirIdx !== -1) {
    const target = args[dirIdx + 1];
    const question = args.slice(dirIdx + 2).join(" ").trim() || undefined;
    if (!target) throw new Error("--dir 后必须跟目录路径");
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
```

- [ ] **步骤 4：再次运行定向测试，确认通过**

运行：`npm run test -- src/__tests__/cli-options.test.ts`
预期：通过

- [ ] **步骤 5：提交**

```bash
git add src/cli-options.ts src/__tests__/cli-options.test.ts
git commit -m "feat: add shared cli option parsing"
```

### 任务 3：增加共享文件与目录加载能力

**文件：**
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\target-loader.ts`
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\__tests__\target-loader.test.ts`

- [ ] **步骤 1：先写失败测试**

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { collectDirectoryFiles } from "../target-loader.js";

describe("collectDirectoryFiles", () => {
  it("会递归收集支持的文件，并生成相对路径", () => {
    const root = join(tmpdir(), `ai-code-explain-${Date.now()}`);
    mkdirSync(join(root, "nested"), { recursive: true });
    writeFileSync(join(root, "index.ts"), "export const a = 1;\n");
    writeFileSync(join(root, "nested", "helper.md"), "# helper\n");

    const result = collectDirectoryFiles(root);

    expect(result.map((item) => item.relativePath)).toEqual(["index.ts", "nested/helper.md"]);
  });

  it("会跳过 node_modules 和隐藏路径", () => {
    const root = join(tmpdir(), `ai-code-explain-${Date.now()}-skip`);
    mkdirSync(join(root, "node_modules"), { recursive: true });
    mkdirSync(join(root, ".cache"), { recursive: true });
    writeFileSync(join(root, "node_modules", "ignored.ts"), "ignored");
    writeFileSync(join(root, ".cache", "hidden.ts"), "hidden");
    writeFileSync(join(root, "keep.ts"), "export const keep = true;");

    const result = collectDirectoryFiles(root);

    expect(result.map((item) => item.relativePath)).toEqual(["keep.ts"]);
  });

  it("当没有可分析文件时抛错", () => {
    const root = join(tmpdir(), `ai-code-explain-${Date.now()}-empty`);
    mkdirSync(root, { recursive: true });

    expect(() => collectDirectoryFiles(root)).toThrow("目录中没有可分析的文件");
  });
});
```

- [ ] **步骤 2：运行定向测试，确认它先失败**

运行：`npm run test -- src/__tests__/target-loader.test.ts`
预期：失败，提示找不到 `../target-loader.js`

- [ ] **步骤 3：写最小实现**

```ts
import { Dirent, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md"]);

export interface LoadedFile {
  absolutePath: string;
  relativePath: string;
  content: string;
}

function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}

function shouldSkipDirent(dirent: Dirent): boolean {
  return dirent.name === "node_modules" || isHiddenName(dirent.name);
}

export function readTargetFile(filePath: string): string {
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, "utf-8");
  if (!content.trim()) {
    throw new Error(`文件 ${filePath} 内容为空`);
  }
  return content;
}

export function collectDirectoryFiles(dirPath: string): LoadedFile[] {
  const root = resolve(dirPath);
  if (!statSync(root).isDirectory()) {
    throw new Error(`${dirPath} 不是目录`);
  }

  const files: LoadedFile[] = [];

  function walk(currentPath: string) {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldSkipDirent(entry)) continue;
      const nextPath = resolve(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(nextPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isHiddenName(entry.name)) continue;
      const extension = entry.name.slice(entry.name.lastIndexOf("."));
      if (!SUPPORTED_EXTENSIONS.has(extension)) continue;
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
```

- [ ] **步骤 4：再次运行定向测试，确认通过**

运行：`npm run test -- src/__tests__/target-loader.test.ts`
预期：通过

- [ ] **步骤 5：提交**

```bash
git add src/target-loader.ts src/__tests__/target-loader.test.ts
git commit -m "feat: add shared directory file collection"
```

### 任务 4：扩展 Prompt 构建，支持问题和目录总结

**文件：**
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\prompts.ts`
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\__tests__\prompts.test.ts`

- [ ] **步骤 1：先写失败测试**

在 `src/__tests__/prompts.test.ts` 中增加这些测试：

```ts
it("提供 question 时会附加用户问题", () => {
  const prompt = buildUserPrompt({
    filePath: "docs/a.md",
    fileContent: "# title",
    question: "这个字段怎么配置？",
  });

  expect(prompt).toContain("用户问题：");
  expect(prompt).toContain("这个字段怎么配置？");
});

it("能基于逐文件结果构建目录 summary prompt", () => {
  const prompt = buildDirectorySummaryPrompt({
    dirPath: "./src/utils",
    question: "找出所有工具函数的作用",
    files: [
      {
        path: "format.ts",
        result: {
          summary: "处理日期格式",
          dependencies: ["dayjs"],
          components: [],
          risks: [],
        },
      },
    ],
  });

  expect(prompt).toContain("./src/utils");
  expect(prompt).toContain("format.ts");
  expect(prompt).toContain("处理日期格式");
  expect(prompt).toContain("找出所有工具函数的作用");
});
```

- [ ] **步骤 2：运行定向测试，确认它先失败**

运行：`npm run test -- src/__tests__/prompts.test.ts`
预期：失败，因为当前还不支持 `question` 和 `buildDirectorySummaryPrompt`

- [ ] **步骤 3：写最小改动**

```ts
export interface AnalysisInput {
  filePath: string;
  fileContent: string;
  question?: string;
}

export interface DirectorySummaryInput {
  dirPath: string;
  question?: string;
  files: Array<{
    path: string;
    result: {
      summary: string;
      dependencies: string[];
      components: string[];
      risks: string[];
    };
  }>;
}

export function buildUserPrompt(input: AnalysisInput): string {
  const questionBlock = input.question
    ? `\n用户问题：\n${input.question}\n`
    : "";

  return `请分析下面这个文件，重点关注：
1. 这个文件做了什么
2. 它依赖了哪些接口或外部能力（API、hook、store、工具函数等）
3. 它渲染或导出了哪些主要组件
4. 是否存在潜在风险（异常处理缺失、边界情况、性能问题等）${questionBlock}

文件路径：
${input.filePath}

文件内容：
\`\`\`
${input.fileContent}
\`\`\`

请严格返回 JSON，字段为 summary、dependencies、components、risks。`;
}

export function buildDirectorySummaryPrompt(input: DirectorySummaryInput): string {
  return `请基于下面这些文件分析结果，总结目录的整体职责、主要工具能力和共性风险。

目录路径：
${input.dirPath}

用户问题：
${input.question || "请概括这个目录"}

逐文件结果：
\`\`\`json
${JSON.stringify(input.files, null, 2)}
\`\`\`

请只返回一个简洁的中文 summary 文本。`;
}
```

- [ ] **步骤 4：再次运行定向测试，确认通过**

运行：`npm run test -- src/__tests__/prompts.test.ts`
预期：通过

- [ ] **步骤 5：提交**

```bash
git add src/prompts.ts src/__tests__/prompts.test.ts
git commit -m "feat: extend prompts for file questions and dir summaries"
```

### 任务 5：拆分 Analyzer 传输层与文件读取

**文件：**
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\analyzer.ts`
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\analyzer-openai.ts`

- [ ] **步骤 1：先在消费方定义失败预期**

下一个任务的 `run-analysis.test.ts` 会直接依赖这些函数导出：

```ts
analyzeContent(filePath: string, fileContent: string, question?: string)
summarizeDirectory(dirPath: string, files: DirectoryFileResult[], question?: string)
```

这一步先把契约定下来，当前 analyzer 还不满足，所以后续会先失败。

- [ ] **步骤 2：确认当前 analyzer 还无法满足这个契约**

运行：`npm run test -- src/__tests__/run-analysis.test.ts`
预期：等下个任务把测试文件加上后，这里会先失败，因为对应导出还不存在

- [ ] **步骤 3：做最小 analyzer 重构**

Anthropic 版目标结构：

```ts
export async function analyzeContent(
  filePath: string,
  fileContent: string,
  question?: string,
): Promise<AnalysisResult> {
  if (!fileContent.trim()) {
    throw new Error(`文件 ${filePath} 内容为空`);
  }

  const client = getClient();
  const modelName = process.env.MODEL_NAME || "official-deepseek-v4-pro";
  const userPrompt = buildUserPrompt({ filePath, fileContent, question });

  const response = await client.messages.create({
    model: modelName,
    max_tokens: 2048,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  const raw = textBlocks.map((b) => (b as any).text).join("");
  if (!raw) throw new Error("模型返回了空内容");
  return parseAnalysisResult(raw);
}

export async function analyzeFile(filePath: string, question?: string): Promise<AnalysisResult> {
  const absolutePath = resolve(filePath);
  const fileContent = readFileSync(absolutePath, "utf-8");
  return analyzeContent(filePath, fileContent, question);
}

export async function summarizeDirectory(
  dirPath: string,
  files: DirectoryFileResult[],
  question?: string,
): Promise<string> {
  const client = getClient();
  const modelName = process.env.MODEL_NAME || "official-deepseek-v4-pro";
  const prompt = buildDirectorySummaryPrompt({ dirPath, files, question });
  const response = await client.messages.create({
    model: modelName,
    max_tokens: 600,
    temperature: 0.2,
    system: "你是一个前端目录分析助手。请只返回简洁中文总结。",
    messages: [{ role: "user", content: prompt }],
  });
  const textBlocks = response.content.filter((b) => b.type === "text");
  const raw = textBlocks.map((b) => (b as any).text).join("").trim();
  if (!raw) throw new Error("模型返回了空内容");
  return raw;
}
```

OpenAI 版做镜像实现，但 `onChunk` 只用于 `analyzeContent`，不用于 `summarizeDirectory`。

- [ ] **步骤 4：运行聚焦测试和 TypeScript 构建，验证重构没有破坏现有能力**

运行：`npm run test -- src/__tests__/prompts.test.ts src/__tests__/analysis-result.test.ts`
预期：通过

运行：`npm run build`
预期：通过

- [ ] **步骤 5：提交**

```bash
git add src/analyzer.ts src/analyzer-openai.ts
git commit -m "refactor: separate analyzer content and dir summary helpers"
```

### 任务 6：增加共享结果类型与运行编排

**文件：**
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\types.ts`
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\run-analysis.ts`
- 新建：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\src\__tests__\run-analysis.test.ts`

- [ ] **步骤 1：先写失败测试**

```ts
import { describe, expect, it, vi } from "vitest";
import { runAnalysis } from "../run-analysis.js";

describe("runAnalysis", () => {
  it("会把文件模式结果包成稳定 envelope", async () => {
    const analyzeContent = vi.fn().mockResolvedValue({
      summary: "文档字段说明",
      dependencies: [],
      components: [],
      risks: [],
    });

    const result = await runAnalysis(
      { mode: "file", target: "./docs/a.md", question: "这个字段怎么配置？" },
      {
        readTargetFile: () => "# config",
        collectDirectoryFiles: vi.fn(),
        analyzeContent,
        summarizeDirectory: vi.fn(),
      },
    );

    expect(result).toEqual({
      mode: "file",
      target: "./docs/a.md",
      result: {
        summary: "文档字段说明",
        dependencies: [],
        components: [],
        risks: [],
      },
    });
    expect(analyzeContent).toHaveBeenCalledWith("./docs/a.md", "# config", "这个字段怎么配置？");
  });

  it("会构建包含 summary 和逐文件结果的目录输出", async () => {
    const analyzeContent = vi
      .fn()
      .mockResolvedValueOnce({
        summary: "格式化时间",
        dependencies: ["dayjs"],
        components: [],
        risks: [],
      })
      .mockResolvedValueOnce({
        summary: "拼接 className",
        dependencies: [],
        components: [],
        risks: ["空值输入要注意"],
      });

    const summarizeDirectory = vi.fn().mockResolvedValue("该目录主要提供格式化与样式工具函数。");

    const result = await runAnalysis(
      { mode: "dir", target: "./src/utils", question: "找出所有工具函数的作用" },
      {
        readTargetFile: vi.fn(),
        collectDirectoryFiles: () => [
          { absolutePath: "/tmp/format.ts", relativePath: "format.ts", content: "export const format = () => {}" },
          { absolutePath: "/tmp/cn.ts", relativePath: "cn.ts", content: "export const cn = () => {}" },
        ],
        analyzeContent,
        summarizeDirectory,
      },
    );

    expect(result).toEqual({
      mode: "dir",
      target: "./src/utils",
      summary: "该目录主要提供格式化与样式工具函数。",
      files: [
        {
          path: "format.ts",
          result: {
            summary: "格式化时间",
            dependencies: ["dayjs"],
            components: [],
            risks: [],
          },
        },
        {
          path: "cn.ts",
          result: {
            summary: "拼接 className",
            dependencies: [],
            components: [],
            risks: ["空值输入要注意"],
          },
        },
      ],
    });
    expect(summarizeDirectory).toHaveBeenCalledWith(
      "./src/utils",
      result.files,
      "找出所有工具函数的作用",
    );
  });
});
```

- [ ] **步骤 2：运行定向测试，确认它先失败**

运行：`npm run test -- src/__tests__/run-analysis.test.ts`
预期：失败，提示缺少 `run-analysis.js`

- [ ] **步骤 3：写最小共享类型和编排实现**

`src/types.ts`：

```ts
import type { AnalysisResult } from "./analysis-result.js";

export interface DirectoryFileResult {
  path: string;
  result: AnalysisResult;
}

export interface FileEnvelope {
  mode: "file";
  target: string;
  result: AnalysisResult;
}

export interface DirectoryEnvelope {
  mode: "dir";
  target: string;
  summary: string;
  files: DirectoryFileResult[];
}

export type CliEnvelope = FileEnvelope | DirectoryEnvelope;
```

`src/run-analysis.ts`：

```ts
import type { AnalysisResult } from "./analysis-result.js";
import type { CliOptions } from "./cli-options.js";
import type { LoadedFile } from "./target-loader.js";
import type { CliEnvelope, DirectoryFileResult } from "./types.js";

interface RunAnalysisDeps {
  readTargetFile: (filePath: string) => string;
  collectDirectoryFiles: (dirPath: string) => LoadedFile[];
  analyzeContent: (filePath: string, fileContent: string, question?: string) => Promise<AnalysisResult>;
  summarizeDirectory: (dirPath: string, files: DirectoryFileResult[], question?: string) => Promise<string>;
}

export async function runAnalysis(options: CliOptions, deps: RunAnalysisDeps): Promise<CliEnvelope> {
  if (options.mode === "file") {
    const content = deps.readTargetFile(options.target);
    const result = await deps.analyzeContent(options.target, content, options.question);
    return { mode: "file", target: options.target, result };
  }

  const loadedFiles = deps.collectDirectoryFiles(options.target);
  const files: DirectoryFileResult[] = [];

  for (const file of loadedFiles) {
    const result = await deps.analyzeContent(file.relativePath, file.content, options.question);
    files.push({ path: file.relativePath, result });
  }

  const summary = await deps.summarizeDirectory(options.target, files, options.question);
  return {
    mode: "dir",
    target: options.target,
    summary,
    files,
  };
}
```

- [ ] **步骤 4：再次运行定向测试，确认通过**

运行：`npm run test -- src/__tests__/run-analysis.test.ts`
预期：通过

- [ ] **步骤 5：提交**

```bash
git add src/types.ts src/run-analysis.ts src/__tests__/run-analysis.test.ts
git commit -m "feat: add shared file and dir analysis orchestration"
```

### 任务 7：把两个 CLI 入口都接到共享编排上

**文件：**
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\cli.ts`
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\cli-openai.ts`

- [ ] **步骤 1：先定义失败预期**

这时共享编排模块已经存在，但两个 CLI 入口仍然直接调用旧的 `analyzeFile`。

运行：`npm run build`
预期：在开始改 import 和调用前后，会先因为入口文件还没接上共享逻辑而需要修正

- [ ] **步骤 2：最小改造 Anthropic CLI**

```ts
import { analyzeContent, summarizeDirectory } from "./src/analyzer.js";
import { parseCliOptions } from "./src/cli-options.js";
import { runAnalysis } from "./src/run-analysis.js";
import { collectDirectoryFiles, readTargetFile } from "./src/target-loader.js";

// ...
const options = parseCliOptions(args);

const result = await runAnalysis(options, {
  readTargetFile,
  collectDirectoryFiles,
  analyzeContent,
  summarizeDirectory,
});

console.log(JSON.stringify(result, null, 2));
```

- [ ] **步骤 3：最小改造 OpenAI CLI**

```ts
import { analyzeContent, summarizeDirectory } from "./src/analyzer-openai.js";
import { parseCliOptions } from "./src/cli-options.js";
import { runAnalysis } from "./src/run-analysis.js";
import { collectDirectoryFiles, readTargetFile } from "./src/target-loader.js";

// ...
const options = parseCliOptions(args);

const result = await runAnalysis(options, {
  readTargetFile,
  collectDirectoryFiles,
  analyzeContent: (filePath, fileContent, question) =>
    analyzeContent(filePath, fileContent, question, {
      onChunk: shouldStream ? (chunk) => process.stderr.write(chunk) : undefined,
    }),
  summarizeDirectory,
});
```

如果最后 `analyzeContent` 的 options 位置改成第四个参数，就同步把测试和实现保持一致，不要留下签名不统一的问题。

- [ ] **步骤 4：运行构建和全量测试**

运行：`npm run test`
预期：通过

运行：`npm run build`
预期：通过

- [ ] **步骤 5：提交**

```bash
git add cli.ts cli-openai.ts
git commit -m "feat: wire file and dir support into both clis"
```

### 任务 8：更新项目文档

**文件：**
- 修改：`F:\FrontEnd\code\swell-ai-agent-learn-map\projects\01-ai-code-explain\README.md`

- [ ] **步骤 1：先确认当前文档确实过时**

README 目前只写了：

```md
npx tsx cli.ts examples/sample.tsx
npx tsx cli-openai.ts examples/sample.tsx
npx tsx cli-openai.ts examples/sample.tsx --stream
```

它需要补上 `--file`、`--dir` 和更新后的 v2 状态。

- [ ] **步骤 2：先确认代码已经完成，再补文档**

运行：`npm run test`
预期：通过

运行：`npm run build`
预期：通过

- [ ] **步骤 3：最小补充 README 示例**

增加这些示例：

```md
npx tsx cli.ts --file ./docs/activity-config.md "这个字段怎么配置？"
npx tsx cli.ts --dir ./src/utils "找出所有工具函数的作用"

npx tsx cli-openai.ts --file ./docs/activity-config.md "这个字段怎么配置？"
npx tsx cli-openai.ts --dir ./src/utils "找出所有工具函数的作用"
npx tsx cli-openai.ts --dir ./src/utils "找出所有工具函数的作用" --stream
```

同时把迭代表里的 v2 明确成 `--file / --dir / streaming`。

- [ ] **步骤 4：做最终验证**

运行：`npm run test`
预期：通过

运行：`npm run build`
预期：通过

- [ ] **步骤 5：提交**

```bash
git add README.md
git commit -m "docs: add file and dir cli usage examples"
```

## 自检

- Spec 覆盖情况：
  - 共享 CLI 解析：任务 2
  - 共享 file / dir 加载：任务 3
  - question 和 dir summary prompt：任务 4
  - analyzer 与目录 summary 传输层改造：任务 5
  - 稳定输出 envelope：任务 6
  - 两个 CLI 保持一致接入：任务 7
  - 文档更新：任务 8
- 占位词检查：
  - 没有留下 `TODO`、`TBD` 或“适当处理”这类空洞描述
- 类型一致性：
  - `CliOptions`、`DirectoryFileResult`、`CliEnvelope`、`analyzeContent`、`summarizeDirectory` 这些名字在各任务里保持一致
