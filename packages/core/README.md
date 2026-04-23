# @struggle-ai/core

Core runtime for Struggle AI. This package owns intent classification, session orchestration, guided and socratic learning flows, ADR generation, and trail export.

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

for await (const chunk of session.sendMessage("Help me build a blogging website with FastAPI")) {
  console.log(chunk);
}
```

## Session Model

`startSession()` returns a `Session` with:

- `state`: current session state
- `sendMessage(message)`: async stream of `ResponseChunk`
- `setMode(mode)`: switch between `guided`, `standard`, and `full-socratic`
- `shareFile(path)`: attach a file path to the session state
- `invokeStuck()`: emit a stuck-session intervention
- `invokeHint(level)`: emit a hint at level `1`, `2`, or `3`
- `exportTrail(outputPath, format)`: write a Markdown learning trail
- `getTrail()`: read accumulated trail entries
- `getADRs()`: read generated ADRs

### Modes

- `guided`: design interview, milestone code generation, comprehension checkpoints, ADRs
- `standard`: one clarification, full code generation, digest checkpoint, ADR
- `full-socratic`: sub-problem decomposition, question loop, explain-it-back checkpoint

### Intents

`classifyIntent()` returns one of:

- `quick_help`
- `debug`
- `project`

## Response Chunks

`sendMessage()` yields structured chunks:

- `text`
- `code`
- `adr`
- `question`
- `checkpoint`
- `sub_problem`

Consumers should switch on `chunk.kind` and render each variant explicitly.

## Trail Export

`exportTrail(path, format)` currently writes Markdown. If `format` is `"pdf"`, core still writes Markdown and emits a warning through `io.notify()`.

Exported trails include:

- session metadata
- chronological transcript
- generated ADRs
- a summary footer of concepts and mode usage

## Prompt Assets

Prompt files live in [`src/prompts`](./src/prompts) and are copied into `dist/prompts` during build. If you change prompt files, rebuild the package before testing consumers against the new output.

## Notes for Consumers

- The package is currently marked `"private": true` in [`package.json`](./package.json), so it is not publish-ready yet.
- The `IO` abstraction is required. Core does not write directly to disk except through the injected `io`.
- The default provider choice comes from environment variables unless you pass an explicit `ProviderConfig`.
