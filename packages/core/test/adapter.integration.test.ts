import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIGS } from "../src/config.js";
import { startSession } from "../src/index.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { MemoryIO, collectChunks } from "./test-helpers.js";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
const describeIf = runIntegration ? describe : describe.skip;

describeIf("adapter integration", () => {
  it("completes and streams against Anthropic", async () => {
    const adapter = createLLMAdapter(DEFAULT_CONFIGS.anthropic);

    const completion = await adapter.complete([
      { role: "system", content: "Reply with exactly: pong" },
      { role: "user", content: "ping" },
    ]);
    expect(completion.toLowerCase()).toContain("pong");

    let streamed = "";
    for await (const chunk of adapter.stream([
      { role: "system", content: "Reply with exactly: stream-ok" },
      { role: "user", content: "ping" },
    ])) {
      streamed += chunk;
    }
    expect(streamed.toLowerCase()).toContain("stream-ok");
  });

  it("uses the coding-agent runtime to inspect a real project file", async () => {
    const projectPath = await mkdtemp(join(tmpdir(), "struggle-live-"));
    await writeFile(join(projectPath, "package.json"), '{ "name": "integration-demo" }\n', "utf8");

    const io = new MemoryIO();
    const session = await startSession(projectPath, io, DEFAULT_CONFIGS.anthropic);
    const turn = await collectChunks(
      session.sendMessage("Read package.json in the project root and tell me the package name only.")
    );

    const combined = turn
      .filter((chunk) => chunk.kind === "text")
      .map((chunk) => chunk.value)
      .join("");
    expect(combined.toLowerCase()).toContain("integration-demo");
  });
});
