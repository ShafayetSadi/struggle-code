import { describe, expect, it } from "vitest";
import { createProgram, formatPrompt, parseSlashCommand } from "../src/index.js";
import { ROOT_MENU_TEXT } from "../src/repl/commands.js";

describe("cli entry", () => {
  it("loads without throwing and exposes a commander program", () => {
    const program = createProgram();
    expect(program.name()).toBe("struggle");
  });

  it("exposes --resume on the root command and repl subcommand", () => {
    const program = createProgram();
    const rootOptionNames = program.options.map((option) => option.attributeName());
    const repl = program.commands.find((command) => command.name() === "repl");
    const replOptionNames = repl?.options.map((option) => option.attributeName()) ?? [];

    expect(rootOptionNames).toContain("resume");
    expect(replOptionNames).toContain("resume");
  });

  it("parses the supported slash commands", () => {
    expect(parseSlashCommand("/mode socratic")).toEqual({ kind: "mode", mode: "socratic" });
    expect(parseSlashCommand("/mode standard")).toEqual({ kind: "mode", mode: "standard" });
    expect(parseSlashCommand("/model")).toEqual({ kind: "model" });
    expect(parseSlashCommand("/login")).toEqual({ kind: "login" });
    expect(parseSlashCommand("/login ")).toEqual({ kind: "login" });
    expect(parseSlashCommand("/login google-antigravity")).toEqual({ kind: "login", provider: "google-antigravity" });
    expect(parseSlashCommand("/providers")).toEqual({ kind: "providers-menu" });
    expect(parseSlashCommand("/providers ")).toEqual({ kind: "providers-menu" });
    expect(parseSlashCommand("/providers openai-codex")).toEqual({ kind: "providers", provider: "openai-codex" });
    expect(parseSlashCommand("/provider openai")).toEqual({ kind: "providers", provider: "openai" });
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
    expect(parseSlashCommand("/resume")).toEqual({ kind: "resume" });
    expect(parseSlashCommand("/resume session-123")).toEqual({ kind: "resume", historyId: "session-123" });
    expect(parseSlashCommand("/exit")).toEqual({ kind: "exit" });
    expect(parseSlashCommand("/quit")).toEqual({ kind: "exit" });
  });

  it("lists /resume and /quit in the root command menu", () => {
    expect(ROOT_MENU_TEXT).toContain("/resume");
    expect(ROOT_MENU_TEXT).toContain("List saved sessions or resume one by id");
    expect(ROOT_MENU_TEXT).toContain("/exit, /quit");
  });

  it("formats the prompt with the active mode", () => {
    expect(formatPrompt("guided")).toContain("guided");
  });
});
