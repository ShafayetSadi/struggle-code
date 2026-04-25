# Chat History & Resume — Design Spec

**Date:** 2026-04-25

## Context

The Struggle AI CLI has no cross-session memory. Every `struggle` invocation starts with an empty `Agent` and no knowledge of prior exchanges. Users have no way to pick up where they left off. This spec adds per-project chat history persistence and a resume mechanism via both a CLI flag and a slash command.

## Goal

- Auto-save the full message history to disk after every exchange.
- Let users resume the last session for a project with `struggle --resume` or `/resume`.

---

## Architecture

### New file: `packages/cli/src/historyStore.ts`

Follows the same pattern as `configStore.ts`. Three functions:

```ts
saveHistory(projectPath: string, messages: AgentMessage[]): Promise<void>
loadHistory(projectPath: string): Promise<AgentMessage[] | null>
clearHistory(projectPath: string): Promise<void>
```

Storage path: `<project-dir>/.struggle-ai/chat-history.json`

File format:
```json
{ "savedAt": "<ISO string>", "messages": [...] }
```

The `.struggle-ai/` directory already exists for trail exports — no new directory creation needed in most cases. `saveHistory` creates it with `mkdir({ recursive: true })` before writing.

### Changes to `packages/core/src/coding-agent/session.ts`

- `createCodingAgentSession(projectPath, io, config, initialMessages?: AgentMessage[])` — optional fourth parameter passed as `messages: initialMessages ?? []` to the `Agent` constructor.
- Session object gains `getMessages(): AgentMessage[]` — returns `[...agent.state.messages]`.

### Changes to `packages/core/src/index.ts`

- `Session` interface gains `getMessages(): AgentMessage[]`.
- `startSession(projectPath, io, config?, initialMessages?)` passes `initialMessages` through to `createCodingAgentSession`.

### Changes to `packages/cli/src/repl.ts`

- `RunReplOptions` gains `resume?: boolean`.
- On startup (both TUI and readline paths): if `resume` is `true`, call `loadHistory(projectPath)`. If messages are returned, pass them to `startSession` as `initialMessages` and print `"resumed <N> messages from last session"`. If `null`, print `"no saved history for this project — starting fresh"` and continue normally.
- After each `await streamChunks(session.sendMessage(...))` in both paths: `void saveHistory(projectPath, session.getMessages())` — fire-and-forget, never blocks the REPL.
- `/resume` handled inline before `handleSlashCommand`, mirroring the existing `/new` inline block. Loads history, recreates `session` with `initialMessages`, resets `replState`, prints notice, clears screen entries (TUI) or stdout (readline).

### Changes to `packages/cli/src/index.ts`

- Adds `.option("--resume", "Resume the last chat session for this project")` to the default action and the `repl` subcommand.
- Passes `resume: options.resume` to `runRepl()`.

### Changes to `packages/cli/src/repl/types.ts`

- Adds `| { kind: "resume" }` to the `SlashCommand` union.

### Changes to `packages/cli/src/repl/commands.ts`

- `parseSlashCommand`: adds `case "resume": return { kind: "resume" }`.
- `ROOT_MENU_TEXT`: adds `/resume` line — `"  /resume                   Resume the last saved session"`.

---

## Data Flow

**Auto-save (every exchange):**
```
user sends message → session.sendMessage() → streamChunks resolves
  → void saveHistory(projectPath, session.getMessages())
```

**`struggle --resume`:**
```
loadHistory(projectPath) → AgentMessage[] | null
  → startSession(projectPath, io, config, messages)
  → Agent initialised with pre-loaded messages
  → REPL starts, prints resume notice
```

**`/resume` inside REPL:**
```
inline handler (before handleSlashCommand)
  → loadHistory(projectPath) → AgentMessage[] | null
  → session = await startSession(..., messages)
  → screen cleared, resume notice printed
  → auto-save continues normally
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Save fails (e.g. disk full) | Error swallowed silently — REPL continues uninterrupted |
| History file missing | `loadHistory` returns `null`; caller starts fresh session with notice |
| History file corrupt (bad JSON) | `JSON.parse` throws, caught, returns `null`; treated as missing |

`/new` does **not** clear the history file — the user can still `/resume` after starting a fresh session.

---

## Files to Modify

| File | Change |
|---|---|
| `packages/cli/src/historyStore.ts` | **New** — save/load/clear history |
| `packages/core/src/coding-agent/session.ts` | Add `initialMessages` param + `getMessages()` |
| `packages/core/src/index.ts` | Add `getMessages()` to `Session`; update `startSession` signature |
| `packages/cli/src/repl.ts` | Auto-save hook + `--resume` startup logic + `/resume` inline handler |
| `packages/cli/src/index.ts` | Add `--resume` flag |
| `packages/cli/src/repl/types.ts` | Add `resume` to `SlashCommand` |
| `packages/cli/src/repl/commands.ts` | Parse `/resume` + add to help text |

---

## Verification

1. `cd` to a project, run `struggle`, send a message, exit with Ctrl+C.
2. Confirm `<project>/.struggle-ai/chat-history.json` exists and contains messages.
3. Run `struggle --resume` — confirm "resumed N messages" notice and the AI has context of the prior exchange.
4. Send a follow-up referencing the first message — confirm the AI answers correctly.
5. Type `/resume` inside an active session — confirm it reloads history, clears screen, prints notice.
6. Run `struggle` (no flag) — confirm fresh session (no history loaded).
7. Delete history file, run `struggle --resume` — confirm "no saved history" notice, no crash.
