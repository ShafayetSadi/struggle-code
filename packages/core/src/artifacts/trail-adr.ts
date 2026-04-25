import { v4 as uuidv4 } from "uuid";

import type { LLMAdapter } from "../llm/adapter.js";
import { loadPrompt } from "../prompts/loader.js";
import { type ModeHistoryEntry } from "../session/state.js";
import type { ADR, IO, SessionState, TrailEntry } from "../types.js";
import { validateADR } from "../validation/adr.js";
import { buildTrailContext, collectDecisionSignals, deriveSessionTopic } from "./trail-context.js";

interface TrailADRInput {
  state: SessionState;
  trail: TrailEntry[];
  adrs: ADR[];
  modeHistory: ModeHistoryEntry[];
}

function fallbackDocLinks(topic: string): string[] {
  const lower = topic.toLowerCase();
  if (lower.includes("fastapi")) return ["https://fastapi.tiangolo.com/tutorial/"];
  if (lower.includes("react")) return ["https://react.dev/learn"];
  if (lower.includes("python")) return ["https://docs.python.org/3/tutorial/"];
  if (lower.includes("typescript") || lower.includes("node")) return ["https://www.typescriptlang.org/docs/"];
  return [];
}

function buildFallbackADR(input: TrailADRInput): ADR {
  const topic = deriveSessionTopic(input.state, input.trail);
  const decisions = collectDecisionSignals(input.trail);
  const sharedFiles =
    input.state.sharedFiles.length > 0 ? input.state.sharedFiles.join(", ") : "the currently active project files";

  return validateADR({
    id: uuidv4(),
    title: `Commit the current direction for ${topic}`,
    context: `The session in ${input.state.projectPath} focused on ${topic} with context from ${sharedFiles}.`,
    decision:
      decisions[decisions.length - 1] ??
      `Continue the work in ${input.state.mode} mode and preserve the current milestone boundary before expanding scope.`,
    consequences:
      "The team gets a portable decision record derived from the session trail, but it should still be reviewed before treating it as final architecture policy.",
    concepts: ["Traceable decisions", "Shared file context", "Incremental delivery"],
    risks: [
      "The trail may not contain enough explicit alternatives if the session moved too quickly.",
      "A generated ADR can sound firmer than the evidence unless the user reviews it before adoption.",
    ],
    docLinks: fallbackDocLinks(topic),
    createdAt: new Date().toISOString(),
  });
}

export function renderADRMarkdown(adr: ADR): string {
  const lines = [
    `# ${adr.title}`,
    "",
    "- Status: draft",
    `- Created At: ${adr.createdAt}`,
    "",
    "## Context",
    "",
    adr.context,
    "",
    "## Decision",
    "",
    adr.decision,
    "",
    "## Consequences",
    "",
    adr.consequences,
    "",
    "## Concepts",
    "",
    ...adr.concepts.map((concept) => `- ${concept}`),
    "",
    "## Risks",
    "",
    ...adr.risks.map((risk) => `- ${risk}`),
    "",
  ];

  if (adr.docLinks.length > 0) {
    lines.push("## References", "");
    lines.push(...adr.docLinks.map((link) => `- ${link}`), "");
  }

  return `${lines.join("\n")}\n`;
}

export async function generateTrailADR(input: TrailADRInput, llm: LLMAdapter, io: IO): Promise<ADR> {
  const prompt = await loadPrompt("trail-adr.md", io);

  try {
    const raw = await llm.complete(
      [
        { role: "system", content: prompt },
        { role: "user", content: buildTrailContext(input.state, input.trail, input.adrs, input.modeHistory) },
      ],
      { reasoning: "low" }
    );
    return validateADR(JSON.parse(raw) as unknown);
  } catch {
    return buildFallbackADR(input);
  }
}
