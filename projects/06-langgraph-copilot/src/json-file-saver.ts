/**
 * JSON 文件持久化 checkpointer —— 解决 MemorySaver 进程结束即丢失的问题
 *
 * 继承 MemorySaver，在每次 put/putWrites 后将 storage 序列化到 JSON 文件，
 * 构造时从 JSON 文件恢复。Uint8Array 用 base64 编码。
 *
 * 写入策略：先写临时文件再原子 rename，防止进程中途退出导致文件损坏。
 * 读取策略：损坏文件自动备份为 .corrupted-{timestamp} 并告警，而非静默丢弃。
 *
 * 用法：
 *   import { JsonFileSaver } from "./json-file-saver.js";
 *   const checkpointer = new JsonFileSaver(".checkpoints/state.json");
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { dirname } from "path";
import { MemorySaver } from "@langchain/langgraph";

// MemorySaver.storage: Record<threadId, Record<checkpointNs, Record<checkpointId, [Uint8Array, Uint8Array, string?]>>>
// MemorySaver.writes: Record<key, Record<innerKey, [string, string, Uint8Array]>>

function uint8ToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString("base64");
}

function base64ToUint8(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

type SerStorage = Record<
  string,
  Record<string, Record<string, [string, string, string | undefined]>>
>;
type SerWrites = Record<string, Record<string, [string, string, string]>>;

export class JsonFileSaver extends MemorySaver {
  private filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    this.loadFromFile();
  }

  private loadFromFile() {
    if (!existsSync(this.filePath)) return;

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(this.filePath, "utf-8"));
    } catch {
      this.backupCorrupted("JSON 解析失败");
      return;
    }

    if (raw === null || typeof raw !== "object") {
      this.backupCorrupted("根节点不是对象");
      return;
    }

    const data = raw as Record<string, unknown>;
    const storageIn = data.storage;
    const writesIn = data.writes;

    // storage/writes 缺失但文件非空 → 可能截断
    if (storageIn === undefined && writesIn === undefined) {
      this.backupCorrupted("缺少 storage 和 writes 字段");
      return;
    }

    // 字段存在但类型非法 → 同样视为损坏（如 { storage: "oops" }）
    if (storageIn !== undefined && (typeof storageIn !== "object" || storageIn === null)) {
      this.backupCorrupted("storage 字段类型非法");
      return;
    }
    if (writesIn !== undefined && (typeof writesIn !== "object" || writesIn === null)) {
      this.backupCorrupted("writes 字段类型非法");
      return;
    }

    try {
      if (storageIn !== undefined) {
        for (const [threadId, namespaces] of Object.entries(storageIn as Record<string, unknown>)) {
          if (typeof namespaces !== "object" || namespaces === null) continue;
          if (!this.storage[threadId]) this.storage[threadId] = {};
          for (const [ns, checkpoints] of Object.entries(namespaces as Record<string, unknown>)) {
            if (typeof checkpoints !== "object" || checkpoints === null) continue;
            if (!this.storage[threadId][ns]) this.storage[threadId][ns] = {};
            for (const [cpId, tuple] of Object.entries(checkpoints as Record<string, unknown>)) {
              if (!Array.isArray(tuple) || tuple.length < 2) continue;
              const [cpB64, metaB64, parentId] = tuple as [unknown, unknown, unknown];
              if (typeof cpB64 !== "string" || typeof metaB64 !== "string") continue;
              this.storage[threadId][ns][cpId] = [
                base64ToUint8(cpB64),
                base64ToUint8(metaB64),
                typeof parentId === "string" ? parentId : undefined,
              ];
            }
          }
        }
      }

      if (writesIn !== undefined) {
        for (const [key, innerMap] of Object.entries(writesIn as Record<string, unknown>)) {
          if (typeof innerMap !== "object" || innerMap === null) continue;
          this.writes[key] = {};
          for (const [innerKey, entry] of Object.entries(innerMap as Record<string, unknown>)) {
            if (!Array.isArray(entry) || entry.length < 3) continue;
            const [taskId, channel, valueB64] = entry as [unknown, unknown, unknown];
            if (
              typeof taskId !== "string" ||
              typeof channel !== "string" ||
              typeof valueB64 !== "string"
            )
              continue;
            this.writes[key][innerKey] = [taskId, channel, base64ToUint8(valueB64)];
          }
        }
      }
    } catch {
      this.backupCorrupted("反序列化过程异常");
    }
  }

  private backupCorrupted(reason: string) {
    const ts = Date.now();
    const backupPath = `${this.filePath}.corrupted-${ts}`;
    try {
      renameSync(this.filePath, backupPath);
    } catch {
      // 备份失败（无权限等），放弃恢复尝试
    }
    console.error(
      `[JsonFileSaver] 检查点文件损坏（${reason}），已备份至 ${backupPath}，从空状态启动`,
    );
  }

  private persistToFile() {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const storageOut: SerStorage = {};
    for (const [threadId, namespaces] of Object.entries(this.storage)) {
      storageOut[threadId] = {};
      for (const [ns, checkpoints] of Object.entries(namespaces)) {
        storageOut[threadId][ns] = {};
        for (const [cpId, [cp, meta, parentId]] of Object.entries(checkpoints)) {
          storageOut[threadId][ns][cpId] = [uint8ToBase64(cp), uint8ToBase64(meta), parentId];
        }
      }
    }

    const writesOut: SerWrites = {};
    for (const [key, innerMap] of Object.entries(this.writes)) {
      writesOut[key] = {};
      for (const [innerKey, [taskId, channel, value]] of Object.entries(innerMap)) {
        writesOut[key][innerKey] = [taskId, channel, uint8ToBase64(value)];
      }
    }

    // 原子写入：先写 .tmp，再 rename
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify({ storage: storageOut, writes: writesOut }));
    renameSync(tmpPath, this.filePath);
  }

  async put(config: any, checkpoint: any, metadata: any) {
    const result = await super.put(config, checkpoint, metadata);
    this.persistToFile();
    return result;
  }

  async putWrites(config: any, writes: any[], taskId: string) {
    await super.putWrites(config, writes, taskId);
    this.persistToFile();
  }
}
