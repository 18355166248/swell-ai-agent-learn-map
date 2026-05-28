import type { ChunkEntry } from "./chunker.js";

interface Section {
  heading: string;
  level: number;
  content: string;
}

/**
 * 按 Markdown 标题切分文档。
 * 每个标题段（# / ## / ###）作为一个语义块，保留标题层级作为上下文前缀。
 * 过长的段（> 800 字符）进一步按段落切分以避免单块过大影响检索精度。
 */
export function chunkByHeading(content: string, source: string): ChunkEntry[] {
  const sections = parseSections(content);
  if (sections.length === 0) return [];

  const chunks: ChunkEntry[] = [];

  for (const sec of sections) {
    const prefix = sec.heading;
    const body = sec.content.trim();
    if (!body) continue;

    if (body.length <= 800) {
      chunks.push({ chunk: `${prefix}\n\n${body}`, source, index: chunks.length });
    } else {
      // 长段按段落拆分，每段保留标题前缀
      const paragraphs = body.split(/\r?\n\r?\n/);
      let buffer = "";

      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        const candidate = buffer ? `${buffer}\n\n${trimmed}` : `${prefix}\n\n${trimmed}`;

        if (buffer && candidate.length > 600) {
          chunks.push({ chunk: `${prefix}\n\n${buffer.trim()}`, source, index: chunks.length });
          buffer = trimmed;
        } else {
          buffer = buffer ? `${buffer}\n\n${trimmed}` : trimmed;
        }
      }

      if (buffer.trim()) {
        chunks.push({ chunk: `${prefix}\n\n${buffer.trim()}`, source, index: chunks.length });
      }
    }
  }

  return chunks;
}

/** 解析 Markdown 标题结构，返回各标题段 */
function parseSections(content: string): Section[] {
  const lines = content.split(/\r?\n/);
  const sections: Section[] = [];

  let currentHeading = "";
  let currentLevel = 0;
  let currentBody: string[] = [];
  let started = false;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (started || currentBody.length > 0) {
        sections.push({
          heading: currentHeading,
          level: currentLevel,
          content: currentBody.join("\n"),
        });
      }
      currentHeading = line.trim();
      currentLevel = headingMatch[1].length;
      currentBody = [];
      started = true;
    } else {
      currentBody.push(line);
    }
  }

  // 最后一个段
  if (started || currentBody.length > 0) {
    sections.push({
      heading: currentHeading || "",
      level: currentLevel,
      content: currentBody.join("\n"),
    });
  }

  // 如果没有标题，整个文档作为一个段
  if (sections.length === 0) {
    sections.push({ heading: "", level: 0, content });
  }

  return sections;
}
