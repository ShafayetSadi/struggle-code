import type { IO } from "../types.js";
import type { LLMAdapter } from "./adapter.js";

export async function safeComplete(
  llm: LLMAdapter,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  fallback: string
): Promise<string> {
  try {
    return await llm.complete(messages, { reasoning: "low" });
  } catch {
    return fallback;
  }
}

export async function collectStream(
  llm: LLMAdapter,
  io: IO,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  fallback: string
): Promise<string> {
  try {
    let fullText = "";
    for await (const chunk of llm.stream(messages, { reasoning: "low" })) {
      fullText += chunk;
      io.stream(chunk);
    }
    return fullText.trim() || fallback;
  } catch {
    io.stream(fallback);
    return fallback;
  }
}
