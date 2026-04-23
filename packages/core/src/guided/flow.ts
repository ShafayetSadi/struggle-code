import { v4 as uuidv4 } from "uuid";

import type { GuidedRuntimeState, MilestoneRecord } from "../session/state.js";
import type { ResponseChunk } from "../types.js";

export interface DesignQuestion {
  category: string;
  question: string;
}

export const DESIGN_QUESTIONS: DesignQuestion[] = [
  {
    category: "user_outcome",
    question: "Who is the first user, and what outcome should they reach in the first working version?",
  },
  {
    category: "workflow",
    question: "What is the core workflow the user must complete from start to finish?",
  },
  {
    category: "data_storage",
    question: "What data has to be stored, and what can stay ephemeral for the first milestone?",
  },
  {
    category: "auth_collaboration",
    question: "Do you need auth, roles, or collaboration in the first release, or can that wait?",
  },
  {
    category: "deployment_runtime",
    question: "Where will this run, and what runtime or deployment constraints matter right now?",
  },
];

export function createGuidedState(topic: string): GuidedRuntimeState {
  return {
    topic,
    questionIndex: 0,
    answers: [],
    milestones: [],
    activeMilestoneIndex: 0,
    awaiting: "design_answer",
  };
}

export function getCurrentDesignQuestion(state: GuidedRuntimeState): DesignQuestion {
  return DESIGN_QUESTIONS[Math.min(state.questionIndex, DESIGN_QUESTIONS.length - 1)] as DesignQuestion;
}

export function shouldFinishInterview(state: GuidedRuntimeState): boolean {
  if (state.answers.length >= 5) {
    return true;
  }
  if (state.answers.length < 3) {
    return false;
  }
  const combined = state.answers.map((answer) => answer.answer.trim()).join(" ");
  return combined.split(/\s+/).length >= 25;
}

export function createDesignBriefMarkdown(state: GuidedRuntimeState): string {
  const lines = [
    `# Design Brief: ${state.topic}`,
    "",
    "## Scope Summary",
    "",
    state.briefSummary ?? `This project focuses on ${state.topic}.`,
    "",
    "## Interview Notes",
    "",
    ...state.answers.flatMap((answer) => [
      `### ${answer.category}`,
      "",
      `Q: ${answer.question}`,
      "",
      `A: ${answer.answer}`,
      "",
    ]),
  ];

  return `${lines.join("\n")}\n`;
}

export function deriveMilestones(topic: string, summary: string): MilestoneRecord[] {
  const lower = `${topic} ${summary}`.toLowerCase();
  const milestones: Array<{ title: string; description: string; checkpointLabel: string }> = [
    {
      title: "Define the first user-facing slice",
      description: `Implement the narrowest working path for ${topic}, including the primary happy path.`,
      checkpointLabel: "Explain the first slice in one sentence before we move on.",
    },
  ];

  if (lower.includes("database") || lower.includes("store") || lower.includes("data") || lower.includes("fastapi")) {
    milestones.push({
      title: "Wire storage and server boundaries",
      description:
        "Add the data model, persistence boundary, and the first server endpoints needed for the happy path.",
      checkpointLabel: "What data crosses the boundary here, and why does it belong in storage?",
    });
  } else {
    milestones.push({
      title: "Shape the internal interfaces",
      description: "Define the modules, interfaces, and data flow that keep the first slice maintainable.",
      checkpointLabel: "Name the main boundary in this milestone and the responsibility on each side.",
    });
  }

  milestones.push({
    title: "Close the loop for delivery",
    description:
      "Add tests, deployment assumptions, and one operational safeguard so the milestone can be demoed reliably.",
    checkpointLabel: "How would you prove this milestone still works after the next refactor?",
  });

  return milestones.map((milestone) => ({
    id: uuidv4(),
    title: milestone.title,
    description: milestone.description,
    completed: false,
    checkpointLabel: milestone.checkpointLabel,
    checkpointAttempts: 0,
  }));
}

export function buildGuidedCodeChunk(topic: string, milestone: MilestoneRecord): ResponseChunk {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const code = [
    "type MilestonePlan = {",
    "  goal: string;",
    "  inputs: string[];",
    "  outputs: string[];",
    "  validation: string;",
    "};",
    "",
    `export const ${slug || "project"}_${milestone.id.slice(0, 6)}: MilestonePlan = {`,
    `  goal: ${JSON.stringify(milestone.title)},`,
    `  inputs: ${JSON.stringify(["user intent", "current session context"])},`,
    `  outputs: ${JSON.stringify(["implementation step", "checkpoint prompt"])},`,
    `  validation: ${JSON.stringify(milestone.description)},`,
    "};",
  ].join("\n");

  return {
    kind: "code",
    language: "ts",
    value: code,
  };
}
