import { DEFAULT_CONFIGS, resolveProviderConfig } from "./config.js";
import { NoopIO } from "./io.js";
import { createLLMAdapter } from "./llm/adapter.js";
import { classifyIntentWithDeps } from "./gate/classifier.js";
import { createSessionEngine } from "./session/engine.js";
import type { IO, Intent, Mode, ProviderConfig, ResponseChunk, SessionState, ADR, TrailEntry } from "./types.js";

export interface Session {
  state: SessionState;
  sendMessage(message: string): AsyncIterable<ResponseChunk>;
  setMode(mode: Mode): void;
  shareFile(path: string): Promise<void>;
  invokeStuck(): AsyncIterable<ResponseChunk>;
  invokeHint(level: 1 | 2 | 3): AsyncIterable<ResponseChunk>;
  exportTrail(outputPath: string, format: "md" | "pdf"): Promise<void>;
  getTrail(): TrailEntry[];
  getADRs(): ADR[];
}

export async function classifyIntent(message: string): Promise<Intent> {
  const config = resolveProviderConfig();
  return classifyIntentWithDeps(message, {
    config,
    adapterFactory: createLLMAdapter,
  });
}

export async function startSession(projectPath: string, io: IO, config?: ProviderConfig): Promise<Session> {
  const providerConfig = config ?? resolveProviderConfig();
  return createSessionEngine(projectPath, io, providerConfig);
}

export { loadConfig, resolveProviderConfig, DEFAULT_CONFIGS } from "./config.js";
export { NoopIO } from "./io.js";
export { createLLMAdapter } from "./llm/adapter.js";
export * from "./types.js";
