# Struggle AI Development Guide

This guide covers the current developer workflow for the Struggle AI monorepo. It is intended to reflect the repository as it exists now, not the original scaffold phase.

## What This Repo Contains

Struggle AI is split into four workspaces:

| Workspace | Purpose |
| --- | --- |
| `packages/core` | Shared session engine, mode runtime, prompt loading, artifacts, and public types |
| `packages/cli` | Terminal interface, REPL, config/auth commands, and terminal rendering |
| `packages/vscode` | VS Code extension shell that talks to the CLI-backed session runtime |
| `apps/landing` | Marketing site built with Next.js |

## Current State

The repo currently provides:

- npm workspaces with strict TypeScript project references
- Biome for formatting and linting
- Vitest suites in each workspace
- a real shared core with guided, standard, and Socratic flows
- a working CLI with REPL commands such as `/mode`, `/share`, `/stuck`, `/hint`, and `/trail export`
- CLI config/auth persistence under `~/.struggle-ai`
- a VS Code extension that starts sessions through a CLI daemon bridge
- a buildable landing page aligned to the current product story

The main active gaps are:

- richer VS Code polish beyond the current shell + trail view
- broader end-to-end verification around live tool use
- longer-term persistence beyond the current session/trail artifacts

## Architecture Rules

These rules are not optional:

1. `packages/core` is environment-agnostic.
2. `packages/core` must not depend on terminal APIs, VS Code APIs, or caller-owned config persistence.
3. Cross-surface behavior belongs in core first, then gets consumed by CLI and VS Code.
4. The stable public contract lives in [packages/core/src/index.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/index.ts) and [packages/core/src/types.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/types.ts).
5. Runtime-specific concerns stay in the caller package.

## First-Time Setup

From the repo root:

```bash
npm install
npm run typecheck
npm run check
npm run build
npm run test
```

If those pass, your local workspace is in good shape.

## Day-to-Day Commands

Run these from the repo root unless noted otherwise.

### Full repo

```bash
npm run typecheck
npm run check
npm run format
npm run build
npm run test
```

### CLI

```bash
npm run dev:cli
npm exec --workspace @struggle-ai/cli struggle -- --help
npm exec --workspace @struggle-ai/cli struggle -- --project /tmp/struggle-fastapi-demo
```

Use the workspace CLI for local verification so you run the code from this repo, not a published package.

### VS Code extension

```bash
npm run dev:vscode
npm run build --workspace struggle-ai-vscode
```

For manual verification, open `packages/vscode` in VS Code and press `F5`.

### Landing page

```bash
npm run dev:landing
npm run build --workspace landing
```

## Package-Specific Guidance

### `packages/core`

- Treat `src/index.ts` and `src/types.ts` as the public contract.
- Keep mode behavior, trail artifacts, prompt loading, and shared orchestration in core.
- If a feature needs filesystem, UI, or environment-specific behavior, express it through `IO` or keep it in the caller package.
- Remember that the build must stage prompt markdown into `dist/prompts`.

### `packages/cli`

- The CLI owns terminal rendering, REPL command parsing, config writes, OAuth/config persistence, and local session ergonomics.
- Shared auth/config helpers live in [packages/cli/src/configStore.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/cli/src/configStore.ts).
- If a user-facing auth/session action belongs in both the REPL and config command surface, keep those two paths aligned.

### `packages/vscode`

- The extension owns activation, the webview shell, the Learning Trail view, and the CLI daemon bridge.
- Keep extension logic explicit in `src/extension.ts`.
- Avoid re-implementing core behavior inside the extension.

### `apps/landing`

- Keep it focused on product communication and demo conversion.
- It is a separate marketing/runtime surface, not part of the shared session engine.

## Config and Auth Behavior

- Core config resolution lives in [packages/core/src/config.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/config.ts).
- CLI provider config is stored in `~/.struggle-ai/config.json`.
- OAuth credentials are stored in `~/.struggle-ai/auth.json`.
- A real logout needs to clear both when the active provider uses saved auth.

## LLM and Runtime Notes

- The provider adapter lives in [packages/core/src/llm/adapter.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/llm/adapter.ts).
- The live coding/session runtime centers on the core session engine plus the coding-agent mode runtime in `packages/core/src/coding-agent`.
- Current provider config supports `anthropic`, `google`, `openai`, plus additional configured variants defined in core config.

## Testing Strategy

Use fast tests in the package that owns the behavior.

- `packages/core` deserves the deepest coverage because both product surfaces depend on it.
- Prefer unit and integration-level verification over expensive end-to-end flows during iteration.
- For release readiness, use the repo-wide gate plus the shared manual QA flow in [manual-testing.md](manual-testing.md).

Recommended release gate:

```bash
npm run check
npm run build
npm run test
```

Then run the workspace CLI smoke test:

```bash
npm exec --workspace packages/cli struggle -- --project /tmp/struggle-fastapi-demo
```

## Recommended Development Flow

When implementing a feature:

1. Start in core if the behavior is shared.
2. Update the public types first if callers need new data.
3. Wire the feature into CLI or VS Code after the shared behavior is stable.
4. Run targeted tests.
5. Re-run the repo-wide gate before handing off.

## Pre-Handoff Checklist

- `npm run typecheck` passes
- `npm run check` passes
- `npm run build` passes
- `npm run test` passes
- your manual smoke test still works for the affected surface
- changed commands, prompts, or workflows are reflected in docs

## Related Docs

- [README.md](/home/shafayetsadi/Projects/friction-hackathon/README.md)
- [architecture.md](architecture.md)
- [manual-testing.md](manual-testing.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [git-workflow.md](git-workflow.md)
