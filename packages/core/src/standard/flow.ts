import type { StandardRuntimeState } from "../session/state.js";
import type { ResponseChunk } from "../types.js";

export function createStandardState(topic: string): StandardRuntimeState {
  return {
    topic,
    clarificationAsked: false,
    delivered: false,
    awaiting: "clarification",
    checkpointAttempts: 0,
  };
}

export function needsClarification(message: string): boolean {
  return message.trim().split(/\s+/).length < 8;
}

export function buildStandardCodeChunk(topic: string, clarification?: string): ResponseChunk {
  const code = [
    `// Standard mode implementation sketch for ${topic}`,
    "export function implementFirstPass() {",
    `  return ${JSON.stringify({
      topic,
      clarification: clarification ?? "Use the default happy path.",
      nextStep: "Turn this sketch into concrete files in the target app.",
    })};`,
    "}",
  ].join("\n");

  return {
    kind: "code",
    language: "ts",
    value: code,
  };
}
