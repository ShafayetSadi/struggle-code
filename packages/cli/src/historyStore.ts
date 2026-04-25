import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentMessage } from "@struggle-ai/core";

const HISTORY_DIR = ".struggle-ai";
const HISTORY_FILE = "chat-history.json";

interface HistoryFile {
  savedAt: string;
  messages: AgentMessage[];
}

function historyPath(projectPath: string): string {
  return join(projectPath, HISTORY_DIR, HISTORY_FILE);
}

export async function saveHistory(projectPath: string, messages: AgentMessage[]): Promise<void> {
  await mkdir(join(projectPath, HISTORY_DIR), { recursive: true });
  const payload: HistoryFile = { savedAt: new Date().toISOString(), messages };
  await writeFile(historyPath(projectPath), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function loadHistory(projectPath: string): Promise<AgentMessage[] | null> {
  try {
    const raw = await readFile(historyPath(projectPath), "utf8");
    const parsed = JSON.parse(raw) as HistoryFile;
    return parsed.messages ?? null;
  } catch {
    return null;
  }
}

export async function clearHistory(projectPath: string): Promise<void> {
  try {
    await unlink(historyPath(projectPath));
  } catch {
    // file may not exist — that's fine
  }
}
