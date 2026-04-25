import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearHistory, listHistories, loadHistory, loadHistoryRecord, saveHistory } from "../src/historyStore.js";

describe("historyStore", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "struggle-ai-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("saveHistory writes messages and loadHistory reads them back", async () => {
    const messages = [{ role: "user", content: [{ type: "text", text: "hello" }] }];
    await saveHistory(dir, "session-a", messages as never);
    const loaded = await loadHistory(dir);
    expect(loaded).toEqual(messages);
  });

  it("loadHistoryRecord reads a specific archived session by id", async () => {
    const sessionA = [{ role: "user", content: [{ type: "text", text: "hello from a" }] }];
    const sessionB = [{ role: "user", content: [{ type: "text", text: "hello from b" }] }];

    await saveHistory(dir, "session-a", sessionA as never);
    await saveHistory(dir, "session-b", sessionB as never);

    await expect(loadHistoryRecord(dir, "session-a")).resolves.toMatchObject({
      id: "session-a",
      title: "hello from a",
      messages: sessionA,
    });
  });

  it("listHistories returns saved sessions newest first with previews", async () => {
    await saveHistory(dir, "session-a", [
      { role: "user", content: [{ type: "text", text: "first saved conversation" }] },
    ] as never);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveHistory(dir, "session-b", [
      { role: "user", content: [{ type: "text", text: "second saved conversation" }] },
    ] as never);

    const histories = await listHistories(dir);

    expect(histories.map((history) => history.id)).toEqual(["session-b", "session-a"]);
    expect(histories[0]).toMatchObject({
      id: "session-b",
      title: "second saved conversation",
      messageCount: 1,
      preview: "second saved conversation",
    });
  });

  it("derives a title from the first user message for saved sessions", async () => {
    await saveHistory(dir, "session-a", [
      { role: "assistant", content: [{ type: "text", text: "intro" }] },
      { role: "user", content: [{ type: "text", text: "build a resume picker like model switcher" }] },
    ] as never);

    await expect(loadHistoryRecord(dir, "session-a")).resolves.toMatchObject({
      title: "build a resume picker like model switcher",
    });
  });

  it("loadHistory returns null when no file exists", async () => {
    expect(await loadHistory(dir)).toBeNull();
  });

  it("loadHistory returns null for corrupt JSON", async () => {
    await mkdir(join(dir, ".struggle-ai"), { recursive: true });
    await writeFile(join(dir, ".struggle-ai", "chat-history.json"), "not-json", "utf8");
    expect(await loadHistory(dir)).toBeNull();
  });

  it("clearHistory removes the file so loadHistory returns null", async () => {
    await saveHistory(dir, "session-a", [] as never);
    await clearHistory(dir);
    expect(await loadHistory(dir)).toBeNull();
  });

  it("clearHistory removes a specific archived session by id", async () => {
    await saveHistory(dir, "session-a", [{ role: "user", content: [{ type: "text", text: "a" }] }] as never);
    await saveHistory(dir, "session-b", [{ role: "user", content: [{ type: "text", text: "b" }] }] as never);

    await clearHistory(dir, "session-a");

    await expect(loadHistoryRecord(dir, "session-a")).resolves.toBeNull();
    await expect(loadHistoryRecord(dir, "session-b")).resolves.toMatchObject({ id: "session-b" });
  });

  it("clearHistory does not throw when no file exists", async () => {
    await expect(clearHistory(dir)).resolves.not.toThrow();
  });
});
