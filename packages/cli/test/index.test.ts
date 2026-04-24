import { describe, expect, it } from "vitest";

import { createProgram, formatPrompt, parseSlashCommand } from "../src/index.js";

describe("cli entry", () => {
  it("loads without throwing and exposes a commander program", () => {
    const program = createProgram();
    expect(program.name()).toBe("struggle");
  });

  it("parses the supported slash commands", () => {
    expect(parseSlashCommand("/mode socratic")).toEqual({ kind: "mode", mode: "socratic" });
    expect(parseSlashCommand("/mode standard")).toEqual({ kind: "mode", mode: "standard" });
    expect(parseSlashCommand("/model")).toEqual({ kind: "model" });
    expect(parseSlashCommand("/model gemini-3-flash")).toEqual({
      kind: "model",
      model: "gemini-3-flash",
    });
    expect(parseSlashCommand("/logout")).toEqual({ kind: "logout" });
    expect(parseSlashCommand("/share src/index.ts")).toEqual({ kind: "share", path: "src/index.ts" });
    expect(parseSlashCommand("/hint 2")).toEqual({ kind: "hint", level: 2 });
    expect(parseSlashCommand("/trail export notes/trail.md --format pdf")).toEqual({
      kind: "trail-export",
      path: "notes/trail.md",
      format: "pdf",
    });
  });

  it("formats the prompt with the active mode", () => {
    expect(formatPrompt("guided")).toContain("guided");
  });
});
