import { access, readFile } from "node:fs/promises";

import type { IO, ResponseChunk } from "../src/types.js";

export class MemoryIO implements IO {
  writes = new Map<string, string>();
  notifications: Array<{ level: "info" | "warn" | "error"; message: string }> = [];
  streams: string[] = [];

  async readFile(path: string): Promise<string> {
    if (this.writes.has(path)) {
      return this.writes.get(path) as string;
    }
    return readFile(path, "utf8");
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.writes.set(path, content);
  }

  async fileExists(path: string): Promise<boolean> {
    if (this.writes.has(path)) {
      return true;
    }
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  notify(level: "info" | "warn" | "error", message: string): void {
    this.notifications.push({ level, message });
  }

  stream(chunk: string): void {
    this.streams.push(chunk);
  }
}

export async function collectChunks(iterable: AsyncIterable<ResponseChunk>): Promise<ResponseChunk[]> {
  const chunks: ResponseChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}
