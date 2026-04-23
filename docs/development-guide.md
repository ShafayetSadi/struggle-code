# Struggle AI Development Guide

This guide is for developers working inside the Struggle AI monorepo after the initial scaffold. It covers the repo layout, package boundaries, local workflows, and the rules that matter when you start implementing real features.

## What This Repo Contains

Struggle AI is split into four workspaces:

| Workspace | Purpose |
| --- | --- |
| `packages/core` | Shared product logic, public types, config resolution, and stub session behavior |
| `packages/cli` | Node CLI shell that consumes `@struggle-ai/core` |
| `packages/vscode` | VS Code extension shell and placeholder webview |
| `apps/landing` | Marketing site built with Next.js |

## Architecture Rules

These rules are not optional:

1. `packages/core` is environment-agnostic.
2. `packages/core` must not import terminal APIs, VS Code APIs, Node-specific file APIs for runtime behavior, or UI libraries.
3. The CLI and VS Code extension talk to core through the `IO` interface.
4. The stable public contract lives in [packages/core/src/index.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/index.ts) and [packages/core/src/types.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/types.ts).
5. If you need new cross-surface behavior, add it in core first, then consume it from CLI and extension.

## Current State

The repo currently provides:

- strict TypeScript project references
- npm workspaces
- Biome for formatting and linting
- Vitest scaffolding in every workspace
- realistic mock session behavior in core
- a working CLI entrypoint
- a compiling VS Code extension bundle
- a buildable landing page

The repo does not yet provide:

- real Socratic flow logic
- real prompt files
- a real CLI REPL
- a real VS Code chat experience
- production-grade persistence

## First-Time Setup

From the repo root:

```bash
npm install
npm run typecheck
npm run check
npm run build
npm run test
```

If all of those pass, your workspace is in a good state.

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
npx @struggle-ai/cli --help
npx @struggle-ai/cli
```

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

The landing app currently uses webpack-backed Next scripts for compatibility in restricted environments.

## Package-Specific Guidance

### `packages/core`

This is the highest-risk package because every other product surface depends on it.

- Keep exported APIs intentional and stable.
- Prefer pure functions and small stateful adapters.
- Keep mock behavior realistic until the real behavior is ready.
- Treat `src/index.ts` as a contract, not just another barrel file.
- If a feature requires file reads or UI effects, express it through `IO` or move it into the caller package.

### `packages/cli`

- The CLI owns terminal rendering, config-file writes, and command parsing.
- It may use Node APIs freely.
- It should consume core as if core were a published library.
- Don’t bypass core types by re-declaring session shapes locally.

### `packages/vscode`

- The extension owns activation, commands, tree views, webviews, and workspace file access.
- Keep bundle entry logic in `src/extension.ts`.
- If you add richer webview communication, keep the contract explicit and typed.
- Avoid pulling core into VS Code-specific assumptions.

### `apps/landing`

- This app is independent of the CLI and extension runtime flow.
- Keep it focused on product communication and demo conversion.
- Don’t let landing-page-only UI dependencies leak into the packages workspace.

## Working on the Core Contract

Before changing public exports from core:

1. Check whether the change affects both CLI and VS Code.
2. Update the types first.
3. Update the stub implementations so downstream UI work still has believable output.
4. Update tests in the package that consumes the changed behavior.
5. Call out the contract change in your PR or handoff notes.

## Config Behavior

Core config resolution is intentionally pure.

- [packages/core/src/config.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/config.ts) resolves provider config and can parse injected config text.
- The CLI owns actual reads and writes to `~/.struggle-ai/config.json`.
- If another surface needs config persistence later, it should implement its own environment-specific loader and writer.

## LLM Adapter Notes

The `pi-ai` wrapper lives in [packages/core/src/llm/adapter.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/llm/adapter.ts).

- It currently targets the installed `@mariozechner/pi-ai` API.
- It supports `anthropic`, `google`, and `openai`.
- It requires API keys to be present in the configured environment variable.
- It adapts the simplified internal `LLMMessage` shape into `pi-ai` context messages.

If you upgrade `@mariozechner/pi-ai`, re-verify the adapter types before changing call sites.

## Testing Strategy

Each workspace has a lightweight passing test so the toolchain stays wired:

- core: intent classification
- cli: entrypoint import
- vscode: placeholder webview markup
- landing: utility function

As real features land:

1. Add unit tests in the package that owns the logic.
2. Keep core behavior well-covered because both shells depend on it.
3. Prefer fast tests over end-to-end-heavy suites during hackathon iteration.

## Recommended Development Flow

When implementing a feature:

1. Start in core if the behavior is shared.
2. Add or update the public types if the shells need new data.
3. Update the stub or real implementation in core.
4. Wire the behavior into CLI or VS Code.
5. Run targeted tests.
6. Run the root verification commands before handing off.

## Pre-Handoff Checklist

Before you hand work to another developer:

- `npm run typecheck` passes
- `npm run check` passes
- `npm run build` passes
- `npm run test` passes
- your package’s manual smoke test still works
- any contract changes are documented clearly

## Related Docs

- [README.md](/home/shafayetsadi/Projects/friction-hackathon/README.md)
- [docs/implementation-plan.md](/home/shafayetsadi/Projects/friction-hackathon/docs/implementation-plan.md)
- [docs/initial-prompt.md](/home/shafayetsadi/Projects/friction-hackathon/docs/initial-prompt.md)
