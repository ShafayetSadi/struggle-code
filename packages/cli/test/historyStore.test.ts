import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearHistory, loadHistory, saveHistory } from "../src/historyStore.js";

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
    await saveHistory(dir, messages as never);
    const loaded = await loadHistory(dir);
    expect(loaded).toEqual(messages);
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
    await saveHistory(dir, [] as never);
    await clearHistory(dir);
    expect(await loadHistory(dir)).toBeNull();
  });

  it("clearHistory does not throw when no file exists", async () => {
    await expect(clearHistory(dir)).resolves.not.toThrow();
  });
});
