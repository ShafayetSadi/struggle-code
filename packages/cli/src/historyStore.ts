import { mkdir, readdir, readFile, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentMessage } from "@struggle-ai/core";

const HISTORY_DIR = ".struggle-ai";
const HISTORY_ARCHIVE_DIR = "history";
const HISTORY_FILE = "chat-history.json";

export interface HistoryRecord {
  id: string;
  title: string;
  savedAt: string;
  messages: AgentMessage[];
}

export interface HistorySummary {
  id: string;
  title: string;
  savedAt: string;
  messageCount: number;
  preview: string;
}

function latestHistoryPath(projectPath: string): string {
  return join(projectPath, HISTORY_DIR, HISTORY_FILE);
}

function historyArchiveDir(projectPath: string): string {
  return join(projectPath, HISTORY_DIR, HISTORY_ARCHIVE_DIR);
}

function historyArchivePath(projectPath: string, historyId: string): string {
  return join(historyArchiveDir(projectPath), `${historyId}.json`);
}

function extractTextBlocks(content: AgentMessage["content"] | undefined): string[] {
  if (content === undefined) {
    return [];
  }
  if (!Array.isArray(content)) {
    return typeof content === "string" && content.trim().length > 0 ? [content.trim()] : [];
  }

  const texts: string[] = [];
  for (const block of content) {
    if ("type" in block && block.type === "text" && "text" in block && typeof block.text === "string") {
      const trimmed = block.text.trim();
      if (trimmed.length > 0) {
        texts.push(trimmed);
      }
    }
  }
  return texts;
}

function extractPreview(messages: AgentMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const text = extractTextBlocks(messages[index]?.content).find((value) => value.length > 0);
    if (text) {
      return text.replace(/\s+/g, " ").slice(0, 72);
    }
  }
  return "no text preview";
}

function extractFirstUserText(messages: AgentMessage[]): string | undefined {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    const text = extractTextBlocks(message.content).find((value) => value.length > 0);
    if (text) {
      return text.replace(/\s+/g, " ");
    }
  }

  return undefined;
}

function deriveHistoryTitle(messages: AgentMessage[]): string {
  const firstUserText = extractFirstUserText(messages);
  if (!firstUserText) {
    return "Untitled session";
  }

  return firstUserText.slice(0, 56);
}

async function readHistoryFile(path: string): Promise<HistoryRecord | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<HistoryRecord>;
    if (!Array.isArray(parsed.messages) || typeof parsed.savedAt !== "string") {
      return null;
    }
    return {
      id: typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : "latest",
      title:
        typeof parsed.title === "string" && parsed.title.trim().length > 0
          ? parsed.title.trim()
          : deriveHistoryTitle(parsed.messages),
      savedAt: parsed.savedAt,
      messages: parsed.messages,
    };
  } catch {
    return null;
  }
}

async function loadNewestArchivedHistory(projectPath: string): Promise<HistoryRecord | null> {
  try {
    const files = await readdir(historyArchiveDir(projectPath));
    const entries = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => ({
          path: join(historyArchiveDir(projectPath), file),
          updatedAt: (await stat(join(historyArchiveDir(projectPath), file))).mtimeMs,
        }))
    );

    const latest = entries.sort((left, right) => right.updatedAt - left.updatedAt)[0];
    return latest ? await readHistoryFile(latest.path) : null;
  } catch {
    return null;
  }
}

export async function saveHistory(projectPath: string, historyId: string, messages: AgentMessage[]): Promise<void> {
  await mkdir(join(projectPath, HISTORY_DIR), { recursive: true });
  await mkdir(historyArchiveDir(projectPath), { recursive: true });
  const payload: HistoryRecord = {
    id: historyId,
    title: deriveHistoryTitle(messages),
    savedAt: new Date().toISOString(),
    messages,
  };
  const encoded = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(historyArchivePath(projectPath, historyId), encoded, "utf8");
  await writeFile(latestHistoryPath(projectPath), encoded, "utf8");
}

export async function loadHistoryRecord(projectPath: string, historyId?: string): Promise<HistoryRecord | null> {
  if (historyId && historyId !== "latest") {
    return readHistoryFile(historyArchivePath(projectPath, historyId));
  }

  const latest = await readHistoryFile(latestHistoryPath(projectPath));
  if (latest) {
    return latest;
  }

  return loadNewestArchivedHistory(projectPath);
}

export async function loadHistory(projectPath: string, historyId?: string): Promise<AgentMessage[] | null> {
  const record = await loadHistoryRecord(projectPath, historyId);
  return record?.messages ?? null;
}

export async function listHistories(projectPath: string): Promise<HistorySummary[]> {
  try {
    const files = await readdir(historyArchiveDir(projectPath));
    const records = (
      await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map((file) => readHistoryFile(join(historyArchiveDir(projectPath), file)))
      )
    )
      .filter((record): record is HistoryRecord => record !== null)
      .sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));

    if (records.length > 0) {
      return records.map((record) => ({
        id: record.id,
        title: record.title,
        savedAt: record.savedAt,
        messageCount: record.messages.length,
        preview: extractPreview(record.messages),
      }));
    }
  } catch {
    // fall back to legacy latest file
  }

  const latest = await readHistoryFile(latestHistoryPath(projectPath));
  if (!latest) {
    return [];
  }

  return [
    {
      id: latest.id || "latest",
      title: latest.title,
      savedAt: latest.savedAt,
      messageCount: latest.messages.length,
      preview: extractPreview(latest.messages),
    },
  ];
}

export async function clearHistory(projectPath: string, historyId?: string): Promise<void> {
  if (historyId) {
    await Promise.allSettled([
      unlink(historyArchivePath(projectPath, historyId)),
      (async () => {
        const latest = await loadHistoryRecord(projectPath);
        if (latest?.id === historyId) {
          await unlink(latestHistoryPath(projectPath));
        }
      })(),
    ]);
    return;
  }

  try {
    await unlink(latestHistoryPath(projectPath));
  } catch {
    // file may not exist
  }

  try {
    await rm(historyArchiveDir(projectPath), { recursive: true, force: true });
  } catch {
    // directory may not exist
  }
}
