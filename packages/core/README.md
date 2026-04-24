# @struggle-ai/core

Core runtime for Struggle AI. It now wraps `@mariozechner/pi-agent-core` and exposes a project-scoped coding agent through the existing `startSession()` API.

## Requirements

- Node.js 20+
- An LLM API key for one supported provider

Supported providers:

- Anthropic via `ANTHROPIC_API_KEY`
- Google via `GOOGLE_API_KEY` or `GEMINI_API_KEY`
- OpenAI via `OPENAI_API_KEY`

Provider resolution defaults to the first available key in that order unless you pass an explicit config to `startSession()`.

## Install

From the monorepo root:

```bash
npm install
npm run build --workspace packages/core
```

To run tests for this package:

```bash
npm run test --workspace packages/core
```

To run the real integration test, set a provider key and opt in explicitly:

```bash
RUN_INTEGRATION_TESTS=1 ANTHROPIC_API_KEY=your_key_here npm run test --workspace packages/core
```

## Public API

Main exports from [`src/index.ts`](./src/index.ts):

- `startSession(projectPath, io, config?)`
- `classifyIntent(message)`
- `createLLMAdapter()`
- `resolveProviderConfig()`
- `loadConfig()`
- `NoopIO`
- all public types from [`src/types.ts`](./src/types.ts)

## Quick Start

```ts
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { startSession, type IO } from "@struggle-ai/core";

class LocalIO implements IO {
  async readFile(path: string) {
    return await readFile(path, "utf8");
  }

  async writeFile(path: string, content: string) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }

  async fileExists(path: string) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  notify(level: "info" | "warn" | "error", message: string) {
    console.log(`[${level}] ${message}`);
  }

  stream(chunk: string) {
    process.stdout.write(chunk);
  }
}

const session = await startSession(process.cwd(), new LocalIO());
const chunks = [];

for await (const chunk of session.sendMessage("Inspect package.json and tell me what package this is.")) {
  chunks.push(chunk);
}

console.log(chunks);
```

## Session Model

`startSession()` returns a `Session` with:

- `state`: current session state
- `sendMessage(message)`: async stream of `ResponseChunk`
- `setMode(mode)`: switch between `guided`, `standard`, and `full-socratic`
- `shareFile(path)`: prioritize a file in future prompts
- `invokeStuck()`: emit a stuck-session intervention
- `invokeHint(level)`: emit a coding hint at level `1`, `2`, or `3`
- `exportTrail(outputPath, format)`: write a Markdown transcript trail
- `getTrail()`: read accumulated trail entries
- `getADRs()`: returns an empty array in the current coding-agent runtime

### Modes

Modes now change the live runtime behavior:

- `guided`: inspect the repo, explain the implementation phases and file ownership, then execute
- `standard`: behave like a normal coding agent with minimal ceremony
- `full-socratic`: explain one phase at a time, quiz the user on that phase, require approval, then execute only that phase before repeating the loop

## Agent Tools

The runtime exposes these project-scoped tools to the model:

- `read_file`
- `write_file`
- `list_files`
- `search_files`
- `run_command`

All file tools are restricted to the session project root. `run_command` also executes from the project root and blocks a small set of obviously destructive commands.

## Response Chunks

`sendMessage()` yields structured chunks. In the current coding-agent runtime, most output is emitted as `text` chunks:

- tool activity summaries such as `[tool] read_file src/index.ts`
- guided or full-socratic plan explanations before coding begins
- full-socratic validation prompts before execution
- assistant responses after tool use
- hint and stuck-session messages

The public `ResponseChunk` type still includes richer variants, but the live coding-agent runtime currently uses text-first streaming for the mode orchestration and execution flow.

## Trail Export

`exportTrail(path, format)` currently writes Markdown. If `format` is `"pdf"`, core still writes Markdown and emits a warning through `io.notify()`.

Exported trails include:

- session metadata
- mode history
- chronological transcript entries

## Prompt Assets

Prompt files in [`src/prompts`](./src/prompts) are still used by helper modules such as `classifyIntent()` and `createLLMAdapter()`-based flows. The coding-agent session runtime itself uses a generated system prompt plus internal planning and validation prompts for guided and full-socratic mode.

## Notes for Consumers

- The package is currently marked `"private": true` in [`package.json`](./package.json), so it is not publish-ready yet.
- The `IO` abstraction is still required for filesystem writes and notifications.
- `startSession()` is the stable entrypoint; the internal runtime is now `pi-agent-core` based.
