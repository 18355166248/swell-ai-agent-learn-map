/** Chunk 条目（不含向量，向量由 embedder 补充） */
export interface ChunkEntry {
  chunk: string;
  source: string;
  index: number;
}

/**
 * 按段落（双换行）切分 Markdown 文本。
 * 短段落自动合并，确保每块尽量接近 300-500 字符。
 */
export function chunkMarkdown(content: string, source: string): ChunkEntry[] {
  // 按双换行切原始段落
  const rawParagraphs = content
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // 合并短段落，控制每块 300-500 字符
  const chunks: string[] = [];
  let buffer = "";

  for (const para of rawParagraphs) {
    if (buffer && buffer.length + para.length > 500) {
      chunks.push(buffer.trim());
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }

  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  return chunks.map((chunk, i) => ({
    chunk,
    source,
    index: i,
  }));
}
