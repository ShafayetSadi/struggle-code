import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIGS } from "../src/config.js";
import { createLLMAdapter } from "../src/llm/adapter.js";
import { startSession } from "../src/index.js";
import { collectChunks, MemoryIO } from "./test-helpers.js";

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

  it("runs one guided happy path end-to-end", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io, DEFAULT_CONFIGS.anthropic);

    await collectChunks(session.sendMessage("Help me build a blogging website with FastAPI"));
    await collectChunks(session.sendMessage("The first user is an author who publishes posts."));
    await collectChunks(session.sendMessage("They draft, preview, and publish from one dashboard."));
    await collectChunks(
      session.sendMessage(
        "Posts and tags persist in a database, auth is simple, and deployment is one FastAPI service on a cloud VM."
      )
    );
    const finalTurn = await collectChunks(
      session.sendMessage(
        "The first milestone matters because it captures the publishing flow, keeps the request boundary narrow, and gives us a testable draft-to-publish path."
      )
    );

    expect(finalTurn.some((chunk) => chunk.kind === "adr")).toBe(true);
    expect(session.getADRs().length).toBeGreaterThan(0);
  });
});
