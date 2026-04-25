# Struggle AI Implementation Plan

This document is the current implementation snapshot and near-term roadmap for the repo. It replaces the earlier scaffold-era plan as the source of truth for what is already built versus what still needs work.

## Current Product Position

Struggle AI is a Socratic coding mentor that takes a clear stance on friction:

- friction in coding should be used intentionally
- comprehension matters more than instant output
- AI should help developers own what they build, not just generate it faster

## What Exists Today

### Shared Core

`packages/core` currently provides:

- a shared `startSession(projectPath, io, config?)` entrypoint
- mode-aware session orchestration
- guided, standard, and Socratic behavior paths
- prompt loading from versioned markdown assets
- project-scoped tool use inside the active runtime
- Learning Trail and related artifact generation
- provider/model resolution and adapter wiring

### CLI

`packages/cli` currently provides:

- a working terminal entrypoint
- REPL commands including `/mode`, `/share`, `/stuck`, `/hint`, and `/trail export`
- provider/model configuration commands
- persisted config/auth handling through `configStore.ts`
- logout behavior across config command and REPL surfaces

### VS Code Extension

`packages/vscode` currently provides:

- an extension command to start a session
- a webview shell for session interaction
- a Learning Trail view in the activity bar
- a CLI daemon bridge for session operations and streamed responses

### Landing Page

`apps/landing` currently provides:

- a polished marketing site aligned with the repo thesis
- product framing around deliberate cognitive friction
- mode, workflow, and Learning Trail storytelling

## What Still Needs Work

These are the highest-value remaining areas:

1. VS Code UX polish
   Improve the extension shell, webview ergonomics, and overall feature completeness relative to the CLI.

2. Stronger automated verification
   Expand test coverage around live tool use, mode transitions, and cross-surface behavior.

3. Artifact and persistence depth
   Improve longer-term persistence and artifact workflows beyond the current session/trail outputs.

4. Demo and submission readiness
   Keep README, landing copy, and manual QA aligned with the actual shipped behavior.

## Current Technical Priorities

### Priority 1: Keep shared contracts stable

- preserve [packages/core/src/index.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/index.ts)
- preserve [packages/core/src/types.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/types.ts)
- move complexity into internals instead of destabilizing the public surface

### Priority 2: Keep docs and prompts aligned

- `docs/modes.md` should stay consistent with runtime mode behavior
- README and landing copy should reflect the actual product stance
- manual QA steps should match the commands the team really uses

### Priority 3: Verify with the real release gate

Use this sequence from the repo root:

```bash
npm run check
npm run build
npm run test
```

Then run the CLI smoke test:

```bash
npm exec --workspace packages/cli struggle -- --project /tmp/struggle-fastapi-demo
```

## Working Rules

1. Shared behavior belongs in core first.
2. Runtime-specific behavior stays in CLI or VS Code.
3. Prompt/assets changes should be reflected in docs where relevant.
4. If README or landing copy says the product works a certain way, the runtime should support that claim.

## Recommended Reading Order

1. [README.md](/home/shafayetsadi/Projects/friction-hackathon/README.md)
2. [development-guide.md](development-guide.md)
3. [architecture.md](architecture.md)
4. [manual-testing.md](manual-testing.md)
5. [modes.md](modes.md)

## Historical Note

The original scaffold brief is preserved in [initial-prompt.md](initial-prompt.md) as historical context. It should not be treated as the current description of the repository.
