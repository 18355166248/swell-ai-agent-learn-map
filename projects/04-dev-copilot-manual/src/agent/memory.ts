import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getStoreDir(): string {
  const dir = resolve(__dirname, "..", "..", ".data", "conversations");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export interface ConversationTurn {
  task: string;
  answer: string;
  timestamp: string;
  /** 压缩后的工具步骤摘要（可选） */
  stepsSummary?: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  turnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMemory {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: ConversationTurn[];
}

function makeId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function buildFile(id: string): string {
  return resolve(getStoreDir(), `${id}.json`);
}

function readConvFile(id: string): ConversationMemory | null {
  const file = buildFile(id);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function writeConvFile(mem: ConversationMemory): void {
  writeFileSync(buildFile(mem.id), JSON.stringify(mem, null, 2), "utf-8");
}

/** 从回答的前 60 字生成一个简短标题 */
function makeTitle(task: string): string {
  const cleaned = task.replace(/[帮我请]\s*/g, "").trim();
  return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
}

// ============================================================
// Public API
// ============================================================

/** 创建新会话并返回 id */
export function createConversation(task: string): ConversationMemory {
  const now = new Date().toISOString();
  const mem: ConversationMemory = {
    id: makeId(),
    title: makeTitle(task),
    createdAt: now,
    updatedAt: now,
    turns: [],
  };
  writeConvFile(mem);
  return mem;
}

/** 获取会话 */
export function getConversation(id: string): ConversationMemory | null {
  return readConvFile(id);
}

/** 向会话追加一轮对话 */
export function appendTurn(
  id: string,
  task: string,
  answer: string,
  stepsSummary?: string,
): ConversationMemory | null {
  const mem = readConvFile(id);
  if (!mem) return null;

  mem.turns.push({
    task,
    answer,
    timestamp: new Date().toISOString(),
    stepsSummary,
  });
  mem.updatedAt = new Date().toISOString();
  // 只在第一轮时更新标题（第一轮的问题最能代表会话主题）
  if (mem.turns.length === 1) {
    mem.title = makeTitle(task);
  }
  writeConvFile(mem);
  return mem;
}

/** 列出所有会话 */
export function listConversations(): ConversationMeta[] {
  const dir = getStoreDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  const metas: ConversationMeta[] = [];
  for (const file of files) {
    const mem = readConvFile(file.replace(".json", ""));
    if (!mem) continue;
    metas.push({
      id: mem.id,
      title: mem.title,
      turnCount: mem.turns.length,
      createdAt: mem.createdAt,
      updatedAt: mem.updatedAt,
    });
  }
  return metas.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** 删除会话 */
export function deleteConversation(id: string): boolean {
  const file = buildFile(id);
  if (!existsSync(file)) return false;
  unlinkSync(file);
  return true;
}

/**
 * 将会话历史格式化为可注入 Agent messages 的上下文文本。
 * 返回 null 表示没有历史可注入。
 */
export function formatHistoryContext(mem: ConversationMemory, maxTurns = 5): string | null {
  if (!mem || mem.turns.length === 0) return null;

  const recent = mem.turns.slice(-maxTurns);
  if (recent.length === 0) return null;

  const blocks = recent.map(
    (turn, i) =>
      `### 第 ${i + 1} 轮\n**用户问题**：${turn.task}\n**你的回答**：${turn.answer.slice(0, 600)}${turn.answer.length > 600 ? "…" : ""}`,
  );

  return [
    "## 📝 对话历史（当前会话已进行 " + mem.turns.length + " 轮）",
    "以下是本轮之前的历史记录。请结合这些上下文理解用户当前问题，用户可能在延续之前的讨论：",
    "",
    ...blocks,
  ].join("\n");
}
