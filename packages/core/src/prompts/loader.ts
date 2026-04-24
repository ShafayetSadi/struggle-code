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
  return fileURLToPath(new URL(`./${name}`, import.meta.url));
}

function sourcePromptPath(name: PromptName): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  if (currentDir.includes(`${sep}dist${sep}prompts`)) {
    return resolve(currentDir, "../../src/prompts", name);
  }
  return resolve(currentDir, name);
}

export async function loadPrompt(name: PromptName, io?: IO, overridePath?: string): Promise<string> {
  const candidatePaths = Array.from(
    new Set(
      [overridePath, bundledPromptPath(name), sourcePromptPath(name)].filter((value): value is string => Boolean(value))
    )
  );

  for (const candidatePath of candidatePaths) {
    if (io) {
      try {
        if (!overridePath && candidatePath === bundledPromptPath(name) && io.fileExists) {
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
