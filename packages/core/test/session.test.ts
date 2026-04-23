import { describe, expect, it } from "vitest";

import { startSession } from "../src/index.js";
import { collectChunks, MemoryIO } from "./test-helpers.js";

describe("session engine", () => {
  it("routes debug prompts without entering the project interview", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);
    const chunks = await collectChunks(session.sendMessage("My useEffect runs twice in development"));

    expect(chunks[0]).toMatchObject({ kind: "text" });
    expect(chunks[1]).toMatchObject({ kind: "question" });
    expect(session.state.activeMilestone).toBe("Waiting for the next task");
  });

  it("completes the guided interview, writes a design brief, and emits a checkpoint", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);

    await collectChunks(session.sendMessage("Help me build a blogging website with FastAPI"));
    await collectChunks(
      session.sendMessage("The first user is an author who needs to publish and edit blog posts quickly.")
    );
    await collectChunks(
      session.sendMessage("They create a draft, preview it, and publish from a simple dashboard.")
    );
    const thirdTurn = await collectChunks(
      session.sendMessage(
        "We only need posts and tags in storage, auth can stay email-only, and deployment is a single FastAPI service on a small cloud VM."
      )
    );

    expect([...io.writes.keys()].some((path) => path.includes("design-brief-"))).toBe(true);
    expect(thirdTurn.some((chunk) => chunk.kind === "checkpoint")).toBe(true);
    expect(thirdTurn.some((chunk) => chunk.kind === "code")).toBe(true);
    expect(session.state.activeMilestone).toBe("Define the first user-facing slice");
  });

  it("does not treat a short meta question as a guided interview answer", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);

    await collectChunks(session.sendMessage("Help me build a blogging website with FastAPI"));
    await collectChunks(session.sendMessage("An author publishes posts for readers."));
    const metaTurn = await collectChunks(session.sendMessage("what is this bug"));

    expect(metaTurn).toEqual([
      {
        kind: "text",
        value:
          "You are still in the scoping interview. Answer the current design question in one or two concrete sentences so I can keep the plan coherent.\n",
      },
      {
        kind: "question",
        text: "What is the core workflow the user must complete from start to finish?",
        awaitsInput: true,
      },
    ]);
    expect(session.state.activeMilestone).toBe("Design interview");
    expect(session.state.activeSubProblem).toBe("Design question 2 of 5");
  });

  it("generates an ADR after a guided checkpoint passes", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);

    await collectChunks(session.sendMessage("Help me build a blogging website with FastAPI"));
    await collectChunks(session.sendMessage("An author publishes posts for readers."));
    await collectChunks(session.sendMessage("They create, preview, and publish posts."));
    await collectChunks(
      session.sendMessage(
        "Posts and tags persist in a database, auth is simple, and deployment is a single FastAPI container with one database."
      )
    );
    const checkpointTurn = await collectChunks(
      session.sendMessage(
        "This milestone defines the first publishing flow because the user needs one clear path, the request and response boundary stays simple, and the test should cover draft to published state."
      )
    );

    expect(checkpointTurn.some((chunk) => chunk.kind === "adr")).toBe(true);
    expect(session.getADRs()).toHaveLength(1);
  });

  it("supports standard mode clarification and digest flow", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);
    session.setMode("standard");

    const firstTurn = await collectChunks(session.sendMessage("Build auth"));
    expect(firstTurn).toEqual([
      {
        kind: "question",
        text: "Give me one sentence on the exact first user outcome so I can generate the first-pass implementation.",
        awaitsInput: true,
      },
    ]);

    const secondTurn = await collectChunks(
      session.sendMessage("A user should be able to sign in and reach a protected dashboard.")
    );
    expect(secondTurn.some((chunk) => chunk.kind === "checkpoint")).toBe(true);

    const thirdTurn = await collectChunks(
      session.sendMessage(
        "The generated code should carry the sign-in outcome through a narrow auth boundary so the dashboard only renders after verification succeeds."
      )
    );
    expect(thirdTurn.some((chunk) => chunk.kind === "adr")).toBe(true);
  });

  it("supports full socratic decomposition and explain-it-back", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);
    session.setMode("full-socratic");

    const firstTurn = await collectChunks(session.sendMessage("Help me build JWT auth"));
    expect(firstTurn.some((chunk) => chunk.kind === "sub_problem")).toBe(true);

    await collectChunks(session.sendMessage("The goal is a sign-in flow with a stable success metric."));
    await collectChunks(session.sendMessage("We prove it with a protected route and one failing test before auth."));
    await collectChunks(session.sendMessage("The auth service owns token issuance and verification."));
    await collectChunks(session.sendMessage("Out of scope is team management for now."));
    await collectChunks(session.sendMessage("A regression test should fail if token verification breaks."));
    const finalTurn = await collectChunks(
      session.sendMessage("The main risk is accepting an invalid token without surfacing the boundary failure.")
    );

    expect(finalTurn.some((chunk) => chunk.kind === "checkpoint" && chunk.kind2 === "explain_it_back")).toBe(true);
  });

  it("exports a readable markdown trail and warns for pdf requests", async () => {
    const io = new MemoryIO();
    const session = await startSession("/tmp/project", io);

    await collectChunks(session.sendMessage("What is a Promise?"));
    await session.exportTrail("/tmp/trail.md", "pdf");

    const markdown = io.writes.get("/tmp/trail.md");
    expect(markdown).toContain("# Struggle AI Learning Trail");
    expect(markdown).toContain("## Transcript");
    expect(io.notifications.some((item) => item.level === "warn")).toBe(true);
    expect(session.getTrail().some((entry) => entry.type === "session_end")).toBe(true);
  });
});
