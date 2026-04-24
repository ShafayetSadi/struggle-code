import { readFile as readFileFromFs } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { IO } from "../types.js";

export type PromptName =
  | "classify.md"
  | "quick-help.md"
  | "debug.md"
  | "design-interview.md"
  | "guided-milestone.md"
  | "comprehension-check.md"
  | "adr-generator.md"
  | "standard-mode.md"
  | "full-socratic-decompose.md"
  | "full-socratic-questions.md"
  | "explain-it-back.md"
  | "stuck-diagnostic.md"
  | "hint-L1.md"
  | "hint-L2.md"
  | "hint-L3.md";

function bundledPromptPath(name: PromptName): string {
  return resolve(getCurrentDir(), name);
}

function sourcePromptPath(name: PromptName): string {
  const currentDir = getCurrentDir();
  if (currentDir.includes(`${sep}dist${sep}prompts`)) {
    return resolve(currentDir, "../../src/prompts", name);
  }
  return resolve(currentDir, name);
}

function getCurrentDir(): string {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }

  return dirname(fileURLToPath(import.meta.url));
}

function safeBundledPromptPath(name: PromptName): string | undefined {
  try {
    return bundledPromptPath(name);
  } catch {
    return undefined;
  }
}

function safeSourcePromptPath(name: PromptName): string | undefined {
  try {
    return sourcePromptPath(name);
  } catch {
    return undefined;
  }
}

export async function loadPrompt(name: PromptName, io?: IO, overridePath?: string): Promise<string> {
  const bundledPath = safeBundledPromptPath(name);
  const sourcePath = safeSourcePromptPath(name);
  const candidatePaths = Array.from(
    new Set([overridePath, bundledPath, sourcePath].filter((value): value is string => Boolean(value)))
  );

  for (const candidatePath of candidatePaths) {
    if (io) {
      try {
        if (!overridePath && bundledPath && candidatePath === bundledPath && io.fileExists) {
          const exists = await io.fileExists(candidatePath);
          if (!exists) {
            continue;
          }
        }
        return await io.readFile(candidatePath);
      } catch {
        // Fall through to local filesystem reads for bundled assets.
      }
    }

    try {
      return await readFileFromFs(candidatePath, "utf8");
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(`Unable to load prompt asset: ${name} (checked: ${candidatePaths.join(", ")})`);
}
