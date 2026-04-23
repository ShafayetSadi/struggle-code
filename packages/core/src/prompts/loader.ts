import { readFile as readFileFromFs } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import type { IO } from "../types.js";

export type PromptName =
  | "classify.md"
  | "design-interview.md"
  | "guided-milestone.md"
  | "comprehension-check.md"
  | "adr-generator.md";

function bundledPromptPath(name: PromptName): string {
  return fileURLToPath(new URL(`./${name}`, import.meta.url));
}

export async function loadPrompt(name: PromptName, io?: IO, overridePath?: string): Promise<string> {
  const candidatePaths = [overridePath, bundledPromptPath(name)].filter((value): value is string => Boolean(value));

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

  throw new Error(`Unable to load prompt asset: ${name}`);
}
