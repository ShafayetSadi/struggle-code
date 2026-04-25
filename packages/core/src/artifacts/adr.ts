import { v4 as uuidv4 } from "uuid";

import type { LLMAdapter } from "../llm/adapter.js";
import { loadPrompt } from "../prompts/loader.js";
import type { ADR, IO } from "../types.js";
import { validateADR } from "../validation/adr.js";

export interface ADRInput {
  projectPath: string;
  topic: string;
  milestoneTitle: string;
  milestoneDescription: string;
  designSummary: string | undefined;
}

function fallbackDocLinks(topic: string): string[] {
  const lower = topic.toLowerCase();
  if (lower.includes("fastapi")) return ["https://fastapi.tiangolo.com/tutorial/"];
  if (lower.includes("react")) return ["https://react.dev/learn"];
  if (lower.includes("python")) return ["https://docs.python.org/3/tutorial/"];
  if (lower.includes("typescript") || lower.includes("node")) return ["https://www.typescriptlang.org/docs/"];
  return [];
}

function buildFallbackADR(input: ADRInput): ADR {
  return validateADR({
    id: uuidv4(),
    title: `Commit to ${input.milestoneTitle}`,
    context:
      input.designSummary ??
      `The session is building ${input.topic} inside ${input.projectPath} and needs one clear architectural step.`,
    decision: input.milestoneDescription,
    consequences: "The team can move forward with a bounded slice, but later milestones still need validation.",
    concepts: ["Bounded scope", "Incremental delivery", "Traceable decisions"],
    risks: [
      "The milestone may hide an integration constraint that only appears once code is wired together.",
      "Skipping a checkpoint could let shallow understanding slip through the session.",
    ],
    docLinks: fallbackDocLinks(input.topic),
    createdAt: new Date().toISOString(),
  });
}

export async function generateADR(input: ADRInput, llm: LLMAdapter, io: IO): Promise<ADR> {
  const prompt = await loadPrompt("adr-generator.md", io);

  try {
    const raw = await llm.complete(
      [
        { role: "system", content: prompt },
        {
          role: "user",
          content: JSON.stringify(input, null, 2),
        },
      ],
      { reasoning: "low" }
    );

    const parsed = JSON.parse(raw) as unknown;
    return validateADR(parsed);
  } catch {
    return buildFallbackADR(input);
  }
}
