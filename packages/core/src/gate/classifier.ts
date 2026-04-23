import type { LLMAdapter } from "../llm/adapter.js";
import { loadPrompt } from "../prompts/loader.js";
import type { Intent, ProviderConfig } from "../types.js";

const VALID_INTENTS = new Set<Intent>(["quick_help", "debug", "project"]);

export interface ClassifierDeps {
  config: ProviderConfig;
  adapterFactory: (config: ProviderConfig) => LLMAdapter;
  promptText?: string;
}

export function fallbackIntentHeuristic(message: string): Intent {
  const lower = message.toLowerCase();
  if (/error|bug|debug|why does|doesn't work|not work|broken|fail|throw|exception|crash|runs twice|issue/.test(lower)) {
    return "debug";
  }
  if (
    /help me build|build|create|make|project|app|website|service|api|system|dashboard|platform|feature|tool/.test(lower)
  ) {
    return "project";
  }
  return "quick_help";
}

function normalizeIntent(raw: string): Intent | undefined {
  const trimmed = raw.trim().toLowerCase();
  return VALID_INTENTS.has(trimmed as Intent) ? (trimmed as Intent) : undefined;
}

export async function classifyIntentWithDeps(message: string, deps: ClassifierDeps): Promise<Intent> {
  const promptText = deps.promptText ?? (await loadPrompt("classify.md"));
  const adapter = deps.adapterFactory(deps.config);

  try {
    const firstPass = normalizeIntent(
      await adapter.complete(
        [
          { role: "system", content: promptText },
          { role: "user", content: message },
        ],
        { reasoning: "minimal" }
      )
    );
    if (firstPass) {
      return firstPass;
    }

    const secondPass = normalizeIntent(
      await adapter.complete(
        [
          { role: "system", content: promptText },
          {
            role: "user",
            content: `Classify this request and reply with only one exact label.\nAllowed labels: quick_help, debug, project.\nRequest: ${message}`,
          },
        ],
        { reasoning: "minimal" }
      )
    );
    if (secondPass) {
      return secondPass;
    }
  } catch {
    // Use the local heuristic when the provider is unavailable or returns malformed output.
  }

  return fallbackIntentHeuristic(message);
}
