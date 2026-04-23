import { v4 as uuidv4 } from "uuid";

import type { SocraticRuntimeState } from "../session/state.js";
import type { ResponseChunk, SubProblem } from "../types.js";

export function deriveSubProblems(topic: string): SubProblem[] {
  return [
    {
      id: uuidv4(),
      description: `Define the goal and success metric for ${topic}.`,
      questions: [
        "What must the user be able to do when this is done?",
        "What evidence would prove the first slice works?",
      ],
      resolved: false,
      order: 1,
    },
    {
      id: uuidv4(),
      description: `Choose the boundary that keeps ${topic} small enough to reason about.`,
      questions: ["What module or service owns the core behavior?", "What can stay out of scope for the first pass?"],
      resolved: false,
      order: 2,
    },
    {
      id: uuidv4(),
      description: `Plan the verification path for ${topic}.`,
      questions: [
        "What test or manual check would fail if this regressed?",
        "Where is the riskiest assumption right now?",
      ],
      resolved: false,
      order: 3,
    },
  ];
}

export function createSocraticState(topic: string): SocraticRuntimeState {
  return {
    topic,
    subProblems: deriveSubProblems(topic),
    activeSubProblemIndex: 0,
    questionIndex: 0,
    awaiting: "question",
    checkpointAttempts: 0,
  };
}

export function buildMinimalCodeChunk(topic: string, subProblem: SubProblem): ResponseChunk {
  return {
    kind: "code",
    language: "ts",
    value: [
      `// Minimal code sketch for ${topic}`,
      `// Resolved sub-problem: ${subProblem.description}`,
      "export const explainableStep = {",
      `  topic: ${JSON.stringify(topic)},`,
      `  subProblem: ${JSON.stringify(subProblem.description)},`,
      '  nextMove: "Write the concrete implementation after the reasoning checks pass.",',
      "};",
    ].join("\n"),
  };
}
