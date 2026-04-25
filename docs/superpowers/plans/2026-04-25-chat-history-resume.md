# Chat History & Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-save per-project chat message history after every exchange and let users resume it via `struggle --resume` or `/resume`.

**Architecture:** A new `historyStore.ts` in the CLI package handles file I/O (JSON at `<project>/.struggle-ai/chat-history.json`). The core `Session` interface gains `getMessages()` and `createCodingAgentSession` accepts optional `initialMessages` to restore history. The REPL wires auto-save after each `sendMessage` and handles `--resume` / `/resume` inline before delegating to `handleSlashCommand`.

**Tech Stack:** Node.js `fs/promises`, TypeScript, Vitest, existing `@mariozechner/pi-agent-core` Agent API.

---

## File Map

| Action | File |
|---|---|
| **Create** | `packages/cli/src/historyStore.ts` |
| **Create** | `packages/cli/test/historyStore.test.ts` |
| **Modify** | `packages/core/src/coding-agent/session.ts` |
| **Modify** | `packages/core/src/index.ts` |
| **Modify** | `packages/core/test/session.test.ts` |
| **Modify** | `packages/cli/src/repl/types.ts` |
| **Modify** | `packages/cli/src/repl/commands.ts` |
| **Modify** | `packages/cli/test/index.test.ts` |
| **Modify** | `packages/cli/src/index.ts` |
| **Modify** | `packages/cli/src/repl.ts` |

---

## Task 1: Core session — `getMessages()` and `initialMessages`

**Files:**
- Modify: `packages/core/src/coding-agent/session.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/test/session.test.ts`

- [ ] **Step 1: Write failing tests for `getMessages()` and `initialMessages` restoration**

Open `packages/core/test/session.test.ts`. At line 49, the `MockAgent` constructor does not accept `messages` from `initialState`. Update the constructor type and body — change lines 42-57:

```ts
constructor(options?: {
  initialState?: {
    systemPrompt?: string;
    thinkingLevel?: string;
    tools?: unknown[];
    model?: unknown;
    messages?: unknown[];
  };
}) {
  this.state = {
    systemPrompt: options?.initialState?.systemPrompt ?? "",
    thinkingLevel: options?.initialState?.thinkingLevel ?? "medium",
    tools: options?.initialState?.tools ?? [],
    messages: (options?.initialState?.messages as string[]) ?? [],
    model: options?.initialState?.model,
  };
  MockAgent.instances.push(this);
}
```

Then append two new tests at the bottom of the `describe("coding agent session", ...)` block (before the closing `}`):

```ts
it("getMessages returns an empty array before any exchange", async () => {
  const io = new MemoryIO();
  const session = await startSession("/tmp/project", io);
  expect(session.getMessages()).toEqual([]);
});

it("restores initialMessages into the agent when provided", async () => {
  const initial = [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: 0 }];
  const io = new MemoryIO();
  const session = await startSession("/tmp/project", io, undefined, initial as never);
  expect(session.getMessages()).toEqual(initial);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test --workspace packages/core
```

Expected: two new tests fail with "session.getMessages is not a function" or similar.

- [ ] **Step 3: Add `AgentMessage` to core exports and `Session` interface**

In `packages/core/src/index.ts`, add the import at the top:

```ts
import type { AgentMessage } from "@mariozechner/pi-agent-core";
```

Add `getMessages()` to the `Session` interface (after `getTrail()`):

```ts
export interface Session {
  state: SessionState;
  sendMessage(message: string): AsyncIterable<ResponseChunk>;
  setMode(mode: Mode): void;
  setProviderConfig(config: ProviderConfig): void;
  shareFile(path: string): Promise<void>;
  invokeStuck(): AsyncIterable<ResponseChunk>;
  invokeHint(level: 1 | 2 | 3): AsyncIterable<ResponseChunk>;
  exportTrail(outputPath: string, format: "md" | "pdf"): Promise<void>;
  getTrail(): TrailEntry[];
  getADRs(): ADR[];
  getMessages(): AgentMessage[];
}
```

Update `startSession` to accept and pass through `initialMessages`:

```ts
export async function startSession(
  projectPath: string,
  io: IO,
  config?: ProviderConfig,
  initialMessages?: AgentMessage[]
): Promise<Session> {
  const providerConfig = config ?? resolveProviderConfig();
  return createCodingAgentSession(projectPath, io, providerConfig, initialMessages);
}
```

Add the re-export so the CLI can import `AgentMessage` from `@struggle-ai/core` (append to the existing exports at the bottom of the file):

```ts
export type { AgentMessage } from "@mariozechner/pi-agent-core";
```

- [ ] **Step 4: Update `createCodingAgentSession` to accept and wire `initialMessages`**

In `packages/core/src/coding-agent/session.ts`, update the import on line 1 to include `AgentMessage`:

```ts
import { Agent, type AgentEvent, type AgentMessage } from "@mariozechner/pi-agent-core";
```

Update the function signature (line 128):

```ts
export async function createCodingAgentSession(
  projectPath: string,
  io: IO,
  config: ProviderConfig,
  initialMessages?: AgentMessage[]
): Promise<Session> {
```

In the `new Agent({...})` call (lines 136-146), add `messages: initialMessages ?? []` to `initialState`:

```ts
const agent = new Agent({
  initialState: {
    systemPrompt: buildSystemPrompt(projectPath, state.mode, state.sharedFiles),
    model: getModel(config.provider as KnownProvider, config.model as never),
    thinkingLevel: getThinkingLevel(state.mode),
    tools: createProjectTools({ projectPath, io }),
    messages: initialMessages ?? [],
  },
  getApiKey: () => resolveProviderApiKey(config),
  sessionId: state.id,
});
```

Add `getMessages()` to the returned object (immediately after `state,` on line 404):

```ts
return {
  state,
  getMessages(): AgentMessage[] {
    return [...agent.state.messages];
  },
  sendMessage(message: string) {
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test --workspace packages/core
```

Expected: all tests pass including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/coding-agent/session.ts packages/core/src/index.ts packages/core/test/session.test.ts
git commit -m "feat(core): add getMessages() to Session and initialMessages to createCodingAgentSession"
```

---

## Task 2: `historyStore.ts` — save, load, clear

**Files:**
- Create: `packages/cli/src/historyStore.ts`
- Create: `packages/cli/test/historyStore.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/cli/test/historyStore.test.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearHistory, loadHistory, saveHistory } from "../src/historyStore.js";

describe("historyStore", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "struggle-ai-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("saveHistory writes messages and loadHistory reads them back", async () => {
    const messages = [{ role: "user", content: [{ type: "text", text: "hello" }] }];
    await saveHistory(dir, messages as never);
    const loaded = await loadHistory(dir);
    expect(loaded).toEqual(messages);
  });

  it("loadHistory returns null when no file exists", async () => {
    expect(await loadHistory(dir)).toBeNull();
  });

  it("loadHistory returns null for corrupt JSON", async () => {
    await mkdir(join(dir, ".struggle-ai"), { recursive: true });
    await writeFile(join(dir, ".struggle-ai", "chat-history.json"), "not-json", "utf8");
    expect(await loadHistory(dir)).toBeNull();
  });

  it("clearHistory removes the file so loadHistory returns null", async () => {
    await saveHistory(dir, [] as never);
    await clearHistory(dir);
    expect(await loadHistory(dir)).toBeNull();
  });

  it("clearHistory does not throw when no file exists", async () => {
    await expect(clearHistory(dir)).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test --workspace packages/cli
```

Expected: tests fail with "Cannot find module '../src/historyStore.js'".

- [ ] **Step 3: Implement `historyStore.ts`**

Create `packages/cli/src/historyStore.ts`:

```ts
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentMessage } from "@struggle-ai/core";

const HISTORY_DIR = ".struggle-ai";
const HISTORY_FILE = "chat-history.json";

interface HistoryFile {
  savedAt: string;
  messages: AgentMessage[];
}

function historyPath(projectPath: string): string {
  return join(projectPath, HISTORY_DIR, HISTORY_FILE);
}

export async function saveHistory(projectPath: string, messages: AgentMessage[]): Promise<void> {
  await mkdir(join(projectPath, HISTORY_DIR), { recursive: true });
  const payload: HistoryFile = { savedAt: new Date().toISOString(), messages };
  await writeFile(historyPath(projectPath), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function loadHistory(projectPath: string): Promise<AgentMessage[] | null> {
  try {
    const raw = await readFile(historyPath(projectPath), "utf8");
    const parsed = JSON.parse(raw) as HistoryFile;
    return parsed.messages ?? null;
  } catch {
    return null;
  }
}

export async function clearHistory(projectPath: string): Promise<void> {
  try {
    await unlink(historyPath(projectPath));
  } catch {
    // file may not exist — that's fine
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test --workspace packages/cli
```

Expected: all CLI tests pass including the 5 new historyStore tests.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/historyStore.ts packages/cli/test/historyStore.test.ts
git commit -m "feat(cli): add historyStore with save/load/clear for per-project chat history"
```

---

## Task 3: Slash command — parse `/resume` and add to help text

**Files:**
- Modify: `packages/cli/src/repl/types.ts`
- Modify: `packages/cli/src/repl/commands.ts`
- Modify: `packages/cli/test/index.test.ts`

- [ ] **Step 1: Write the failing test**

In `packages/cli/test/index.test.ts`, add one assertion inside the existing "parses the supported slash commands" test, after the last `expect` line:

```ts
expect(parseSlashCommand("/resume")).toEqual({ kind: "resume" });
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test --workspace packages/cli
```

Expected: test fails — `parseSlashCommand("/resume")` returns `{ kind: "root-menu" }` instead of `{ kind: "resume" }`.

- [ ] **Step 3: Add `resume` to the `SlashCommand` union**

In `packages/cli/src/repl/types.ts`, add `| { kind: "resume" }` to the union (after `| { kind: "new" }`):

```ts
export type SlashCommand =
  | { kind: "root-menu" }
  | { kind: "help" }
  | { kind: "mode-menu" }
  | { kind: "providers-menu" }
  | { kind: "model" }
  | { kind: "copy" }
  | { kind: "clear" }
  | { kind: "new" }
  | { kind: "resume" }
  | { kind: "exit" }
  | { kind: "login"; provider?: string }
  | { kind: "providers"; provider?: string }
  | { kind: "logout" }
  | { kind: "mode"; mode: Mode }
  | { kind: "model"; model?: string }
  | { kind: "share"; path: string }
  | { kind: "stuck" }
  | { kind: "hint"; level?: 1 | 2 | 3 }
  | { kind: "trail-export"; path?: string; format: "md" | "pdf" };
```

- [ ] **Step 4: Add `resume` to `parseSlashCommand` and `ROOT_MENU_TEXT`, and handle it in `handleSlashCommand`**

In `packages/cli/src/repl/commands.ts`:

1. In `ROOT_MENU_TEXT`, add the `/resume` line after the `/new` line:

```ts
export const ROOT_MENU_TEXT = `
Commands:
  /help                     Hints & stuck commands
  /login [provider]         Show providers or authenticate one directly
  /providers [provider]     Show providers or switch the active provider
  /logout                   Clear saved credentials for the active provider
  /mode                     Show available learning modes
  /model [model-id]         Show active model or switch models
  /copy                     Copy the latest generated output
  /clear                    Clear the transcript
  /new                      Start a fresh session
  /resume                   Resume the last saved session
  /share <path>             Share a file with the active session
  /trail export [path] [--format md|pdf]
                            Export the learning trail
`.trim();
```

2. In `parseSlashCommand`, add `case "resume"` before `default`:

```ts
case "resume":
  return { kind: "resume" };
```

3. In `handleSlashCommand`, add `case "resume"` to the switch (it is handled inline in the REPL before this function is called, but the case must exist for TypeScript exhaustiveness). Add it after `case "new"`:

```ts
case "copy":
case "clear":
case "new":
case "resume":
  return "continue";
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test --workspace packages/cli
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/repl/types.ts packages/cli/src/repl/commands.ts packages/cli/test/index.test.ts
git commit -m "feat(cli): add /resume slash command to parser and help text"
```

---

## Task 4: CLI `--resume` flag

**Files:**
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Add `--resume` to the default action**

In `packages/cli/src/index.ts`, the default action starts at line 58. Add `.option("--resume", "Resume the last chat session for this project")` and update the `action` options type and `runRepl` call:

```ts
program
  .name("struggle")
  .description("Struggle AI CLI")
  .version("0.1.0")
  .option("--project <path>", "Project path for the interactive session", process.cwd())
  .option("--provider <provider>", "Override provider for this run")
  .option("--model <model>", "Override model for this run")
  .option("--resume", "Resume the last chat session for this project")
  .action(async (options: { model?: string; project: string; provider?: string; resume?: boolean }) => {
    const configValue = await ensureReadyConfig(options);
    await runRepl({
      projectPath: options.project,
      io: cliIO,
      config: configValue,
      resume: options.resume,
    });
  });
```

- [ ] **Step 2: Add `--resume` to the `repl` subcommand**

Find the `program.command("repl")` block (around line 153) and apply the same change:

```ts
program
  .command("repl")
  .description("Start the interactive REPL")
  .option("--project <path>", "Project path for the interactive session", process.cwd())
  .option("--provider <provider>", "Override provider for this run")
  .option("--model <model>", "Override model for this run")
  .option("--resume", "Resume the last chat session for this project")
  .action(async (options: { model?: string; project: string; provider?: string; resume?: boolean }) => {
    const configValue = await ensureReadyConfig(options);
    await runRepl({
      projectPath: options.project,
      io: cliIO,
      config: configValue,
      resume: options.resume,
    });
  });
```

- [ ] **Step 3: Run tests to confirm nothing is broken**

```bash
npm run test --workspace packages/cli
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): add --resume flag to start and repl commands"
```

---

## Task 5: REPL wiring — auto-save, startup resume, `/resume` inline handler

**Files:**
- Modify: `packages/cli/src/repl.ts`

- [ ] **Step 1: Add imports and `resume` option to `RunReplOptions`**

At the top of `packages/cli/src/repl.ts`, add the historyStore import after the existing local imports:

```ts
import { loadHistory, saveHistory } from "./historyStore.js";
```

Update the `RunReplOptions` interface (around line 105):

```ts
export interface RunReplOptions {
  projectPath?: string;
  io?: IO;
  config?: ProviderConfig;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  resume?: boolean;
}
```

- [ ] **Step 2: Wire startup resume in `runReadlineFallback`**

In `runReadlineFallback` (starts around line 113), replace the `startSession` call at line 117 with resume-aware startup:

```ts
async function runReadlineFallback(options: RunReplOptions = {}): Promise<void> {
  const projectPath = options.projectPath ?? process.cwd();
  const io = options.io ?? cliIO;
  let currentConfig = options.config ?? DEFAULT_CONFIGS.anthropic;

  const initialMessages = options.resume ? (await loadHistory(projectPath)) ?? undefined : undefined;
  let session = await startSession(projectPath, io, currentConfig, initialMessages);
  setAvailableProviders(await listAuthenticatedProviders());
  let lastGeneratedText: string | undefined;
  const replState: ReplState = {
    hintLevel: 1,
    lastMilestone: session.state.activeMilestone,
  };
```

After the `process.stdout.write(chalk.hex(P.textPrimary).bold("Struggle AI") ...)` banner lines (around line 196), add the resume notice:

```ts
process.stdout.write(chalk.hex(P.textPrimary).bold("Struggle AI") + chalk.hex(P.textMuted)("  interactive\n"));
process.stdout.write(chalk.hex(P.textMuted)(`${COMMAND_HINT}\n\n`));

if (options.resume) {
  if (initialMessages) {
    process.stdout.write(chalk.hex(P.textMuted)(`resumed ${initialMessages.length} messages from last session\n\n`));
  } else {
    process.stdout.write(chalk.hex(P.textMuted)("no saved history for this project — starting fresh\n\n"));
  }
}
```

- [ ] **Step 3: Add `/resume` inline handler and auto-save in `runReadlineFallback`**

In the readline loop (around line 210), add the `/resume` block after the `/new` block (after line 234):

```ts
if (command.kind === "new") {
  session = await startSession(projectPath, io, currentConfig);
  replState.hintLevel = 1;
  replState.lastMilestone = session.state.activeMilestone;
  process.stdout.write(chalk.hex(P.green)("started a fresh session\n"));
  process.stdout.write(chalk.hex(P.textMuted)(`${COMMAND_HINT}\n`));
  continue;
}
if (command.kind === "resume") {
  const resumedMessages = (await loadHistory(projectPath)) ?? undefined;
  session = await startSession(projectPath, io, currentConfig, resumedMessages);
  replState.hintLevel = 1;
  replState.lastMilestone = session.state.activeMilestone;
  if (resumedMessages) {
    process.stdout.write(chalk.hex(P.green)(`resumed ${resumedMessages.length} messages from last session\n`));
  } else {
    process.stdout.write(chalk.hex(P.textMuted)("no saved history for this project — starting fresh\n"));
  }
  process.stdout.write(chalk.hex(P.textMuted)(`${COMMAND_HINT}\n`));
  continue;
}
```

After the `streamChunks(session.sendMessage(...))` call (around line 273), add the auto-save line immediately after `lastGeneratedText = responseLines.join("\n").trimEnd();`:

```ts
await streamChunks(session.sendMessage(trimmed), (chunk) => {
  const lines = formatChunk(chunk);
  responseLines.push(...lines);
  for (const line of lines) process.stdout.write(`${line}\n`);
});
lastGeneratedText = responseLines.join("\n").trimEnd();
void saveHistory(projectPath, session.getMessages());
```

- [ ] **Step 4: Wire startup resume in the TUI `runRepl` path**

In `runRepl` (starts around line 300), replace the `startSession` call at line 322 with resume-aware startup:

```ts
const initialMessages = options.resume ? (await loadHistory(projectPath)) ?? undefined : undefined;
let session = await startSession(projectPath, io, currentConfig, initialMessages);
```

After `screen.append("system", COMMAND_HINT);` (around line 435), add the resume notice:

```ts
for (const line of pending.splice(0)) screen.append("system", line);
screen.append("system", COMMAND_HINT);

if (options.resume) {
  if (initialMessages) {
    screen.append("system", `resumed ${initialMessages.length} messages from last session`);
  } else {
    screen.append("system", "no saved history for this project — starting fresh");
  }
}
```

- [ ] **Step 5: Add `/resume` inline handler in `submitValue` (TUI path)**

In `submitValue` (around line 494), add the `/resume` block after the `/new` block (after line 564):

```ts
if (command.kind === "new") {
  screen.clearEntries();
  session = await startSession(projectPath, io, currentConfig);
  replState.hintLevel = 1;
  replState.lastMilestone = session.state.activeMilestone;
  screen.setMode(session.state.mode);
  screen.setActiveSubProblem(session.state.activeSubProblem);
  screen.append("system", "started a fresh session");
  screen.append("system", COMMAND_HINT);
  return;
}
if (command.kind === "resume") {
  screen.clearEntries();
  const resumedMessages = (await loadHistory(projectPath)) ?? undefined;
  session = await startSession(projectPath, io, currentConfig, resumedMessages);
  replState.hintLevel = 1;
  replState.lastMilestone = session.state.activeMilestone;
  screen.setMode(session.state.mode);
  screen.setActiveSubProblem(session.state.activeSubProblem);
  const notice = resumedMessages
    ? `resumed ${resumedMessages.length} messages from last session`
    : "no saved history for this project — starting fresh";
  screen.append("system", notice);
  screen.append("system", COMMAND_HINT);
  return;
}
```

- [ ] **Step 6: Add auto-save in the TUI `submitValue` path**

After `lastGeneratedText = responseLines.join("\n").trimEnd();` (around line 634) in `submitValue`, add:

```ts
lastGeneratedText = responseLines.join("\n").trimEnd();
void saveHistory(projectPath, session.getMessages());
```

- [ ] **Step 7: Run all tests to confirm nothing is broken**

```bash
npm run test --workspace packages/core && npm run test --workspace packages/cli
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/repl.ts
git commit -m "feat(cli): wire chat history auto-save, --resume startup, and /resume slash command"
```

---

## Verification (Manual End-to-End)

Run these steps after all tasks are complete to confirm the full flow works:

1. `cd` into any project directory that has Struggle AI configured.
2. Run `struggle`, send one message, exit with Ctrl+C.
3. Confirm `<project>/.struggle-ai/chat-history.json` exists and contains a `messages` array.
4. Run `struggle --resume`. Confirm "resumed N messages" notice appears.
5. Send a follow-up that references the first message. Confirm the AI has context.
6. Run `struggle` (no flag). Confirm a fresh session starts with no history notice.
7. Inside an active session, type `/resume`. Confirm screen clears and resume notice appears.
8. Delete `<project>/.struggle-ai/chat-history.json`. Run `struggle --resume`. Confirm "no saved history — starting fresh" with no crash.
