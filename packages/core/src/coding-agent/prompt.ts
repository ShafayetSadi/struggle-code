import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Mode } from "../types.js";

function describeMode(mode: Mode): string {
  if (mode === "guided") {
    return [
      "Work carefully and narrate the plan briefly before major edits.",
      "Inspect relevant files before changing them.",
      "After edits, explain what changed and why in concise terms.",
    ].join(" ");
  }

  if (mode === "full-socratic") {
    return [
      "Work in a maximally rigorous way.",
      "Break the task into explicit sub-problems internally, validate assumptions with tools, and verify the riskiest paths before you stop.",
      "Keep the final answer concise despite the deeper investigation.",
    ].join(" ");
  }

  return [
    "Work directly and pragmatically.",
    "Use tools to inspect, edit, and verify with minimal ceremony.",
    "Prefer the smallest correct change that solves the task.",
  ].join(" ");
}

function getModesDocPath(): string {
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
    "- Inspect the existing code before editing.",
    "- Use tools instead of guessing about file contents or command results.",
    "- Make concrete code changes when the user asks for implementation work.",
    "- After changes, run focused verification when feasible.",
    "- Be concise in your user-facing explanations.",
    "",
    "Tooling rules:",
    "- Use read_file before editing an existing file.",
    "- Use list_files or search_files to orient yourself before broad edits.",
    "- Use write_file to create or update files.",
    "- Use run_command for build, test, lint, git, and project inspection commands.",
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
