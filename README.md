# Struggle AI

Struggle AI is a TypeScript monorepo for a Socratic coding mentor delivered as a shared core library, a CLI, a VS Code extension, and a landing page. This scaffold provides the stable contracts, useful stubs, and workspace wiring the team needs to start parallel implementation immediately.

## Packages

| Workspace | Package | Purpose |
| --- | --- | --- |
| `packages/core` | `@struggle-ai/core` | Shared domain types, config, LLM adapter, and session stubs |
| `packages/cli` | `@struggle-ai/cli` | Node CLI shell around the core package |
| `packages/vscode` | `struggle-ai-vscode` | VS Code extension scaffold and placeholder UI |
| `apps/landing` | `landing` | Next.js landing page for the project |

## Quick Start

```bash
npm install
npm run build
```

Master plan: [docs/implementation-plan.md](docs/implementation-plan.md)

Release workflow: [docs/release-guide.md](docs/release-guide.md)

