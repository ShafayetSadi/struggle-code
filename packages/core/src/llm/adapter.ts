import {
  type AssistantMessage,
  type Context,
  type KnownProvider,
  completeSimple,
  getModel,
  streamSimple,
} from "@mariozechner/pi-ai";

import type { ProviderConfig } from "../types.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionOptions {
  reasoning?: "minimal" | "low" | "medium" | "high" | "xhigh";
}

export interface LLMAdapter {
  complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string>;
  stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string>;
}

function withProviderApiKey<T>(config: ProviderConfig, run: (apiKey: string) => Promise<T>): Promise<T> {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing API key: set ${config.apiKeyEnv} in your environment`);
  }
  return run(apiKey);
}

function normalizePlainTextOutput(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function extractPlainText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .flatMap((block) => {
      if (typeof block !== "object" || block === null) {
        return [];
      }
      const candidate = block as { type?: string; text?: string };
      return candidate.type === "text" && typeof candidate.text === "string" ? [candidate.text] : [];
    })
    .join("");
}

export function createLLMAdapter(config: ProviderConfig): LLMAdapter {
  const model = getModel(config.provider as KnownProvider, config.model as never);

  function toContext(messages: LLMMessage[]): Context {
    const [firstMessage, ...rest] = messages;
    const systemPrompt = firstMessage?.role === "system" ? firstMessage.content : undefined;
    const conversation = (systemPrompt ? rest : messages).map((message) => {
      if (message.role === "assistant") {
        const assistantMessage: AssistantMessage = {
          role: "assistant",
          content: [{ type: "text", text: message.content }],
          api: model.api,
          provider: config.provider,
          model: config.model,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: "stop",
          timestamp: Date.now(),
        };
        return assistantMessage;
      }

      return {
        role: "user" as const,
        content: message.content,
        timestamp: Date.now(),
      };
    });

    return {
      messages: conversation,
      ...(systemPrompt ? { systemPrompt } : {}),
    };
  }

  return {
    async complete(messages, options) {
      return withProviderApiKey(config, async (apiKey) => {
        const response = await completeSimple(model, toContext(messages), {
          apiKey,
          ...(options?.reasoning ? { reasoning: options.reasoning } : {}),
        });
        return normalizePlainTextOutput(extractPlainText(response.content));
      });
    },
    async *stream(messages, options) {
      const events = await withProviderApiKey(config, async (apiKey) =>
        streamSimple(model, toContext(messages), {
          apiKey,
          ...(options?.reasoning ? { reasoning: options.reasoning } : {}),
        })
      );

      for await (const event of events) {
        if (event.type === "text_delta") {
          yield event.delta.replace(/\r/g, "");
        }
      }
    },
  };
}
