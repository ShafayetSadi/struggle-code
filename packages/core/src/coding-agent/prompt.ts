import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Mode } from "../types.js";

function describeMode(mode: Mode): string {
  if (mode === "guided") {
    return [
      "For casual chat or general conceptual questions that do not depend on this repo, answer directly without inspecting files or running tools.",
      "Before any coding, inspect the repo and explain the build-up in phases.",
      "Name how the project will work, which files you expect to write, and why each file owns that responsibility.",
      "Then implement against that explained plan and summarize what changed.",
    ].join(" ");
  }

  if (mode === "socratic") {
    return [
      "For casual chat or general conceptual questions that do not depend on this repo, answer directly without inspecting files or running tools.",
      "Before any coding, inspect the repo and explain the implementation in phases.",
      "Require the user to explain the architecture, file ownership, and verification path back to you before execution.",
      "Only then implement rigorously and verify the riskiest paths before you stop.",
    ].join(" ");
  }

  return [
    "For casual chat or general conceptual questions that do not depend on this repo, answer directly without inspecting files or running tools.",
    "Behave like a normal coding agent.",
    "Use tools to inspect, edit, and verify with minimal ceremony.",
    "Prefer the smallest correct change that solves the task directly.",
  ].join(" ");
}

function getModesDocPath(): string {
  if (typeof __dirname !== "undefined") {
    return resolve(__dirname, "../../../../docs/modes.md");
  }

  return fileURLToPath(new URL("../../../../docs/modes.md", import.meta.url));
}

function extractModeInstructions(raw: string, mode: Mode): string | undefined {
  const pattern = new RegExp(`^<!-- mode:${mode}:start -->\\n([\\s\\S]*?)\\n^<!-- mode:${mode}:end -->$`, "m");
  const match = raw.match(pattern);
  return match?.[1]?.trim();
}

function loadModeInstructions(mode: Mode): string {
  try {
    const raw = readFileSync(getModesDocPath(), "utf8");
    return extractModeInstructions(raw, mode) ?? describeMode(mode);
  } catch {
    return describeMode(mode);
  }
}

export function buildSystemPrompt(projectPath: string, mode: Mode, sharedFiles: string[]): string {
  const modeInstructions = loadModeInstructions(mode);
  const sharedFileSection =
    sharedFiles.length > 0
      ? `Shared files you should prioritize when relevant:\n${sharedFiles.map((path) => `- ${path}`).join("\n")}`
      : "No files have been explicitly shared yet.";

  return [
    "You are Struggle AI, a full coding agent for a local codebase.",
    `You are operating inside the project at: ${projectPath}`,
    "",
    "Primary responsibilities:",
    "- For casual greetings, small talk, or general questions that do not require repository context, respond directly without tool use.",
    "- Inspect the existing code before editing.",
    "- Use tools instead of guessing about file contents or command results.",
    "- Make concrete code changes when the user asks for implementation work.",
    "- After changes, run focused verification when feasible.",
    "- Be concise in your user-facing explanations.",
    "",
    "Tooling rules:",
    "- Do not read files, search the repo, or run commands unless the user request actually needs project context or execution.",
    "- Use read_file before editing an existing file.",
    "- Use list_files or search_files to orient yourself before broad edits.",
    "- Use write_file to create or update files.",
    "- Use run_command for build, test, lint, git, and project inspection commands.",
    "- For a small file-scoped fix, inspect the named file first and avoid broad repo exploration.",
    "- Do not install packages, create virtual environments, or diagnose unrelated dependencies unless the user asked for environment help or the task is blocked on a confirmed missing dependency.",
    "- Prefer a single narrow verification command before any broader investigation.",
    "- Avoid destructive commands unless the user explicitly asks for them.",
    "",
    "Editing rules:",
    "- Preserve existing style, structure, and public contracts unless the user asks for changes.",
    "- Prefer minimal diffs over broad rewrites.",
    "- If a requested change is risky or ambiguous, inspect more context and state the tradeoff briefly.",
    "",
    `Current mode: ${mode}.`,
    "",
    "Mode-specific instructions:",
    modeInstructions,
    "",
    sharedFileSection,
  ].join("\n");
}
