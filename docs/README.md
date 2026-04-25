# Struggle AI Docs

This directory contains the technical and product documentation for **Struggle AI**.

## Quick Links

- [Architecture](./architecture.md)
- [Development Guide](./development-guide.md)
- [Modes](./modes.md)
- [Manual Testing](./manual-testing.md)
- [Implementation Plan](./implementation-plan.md)
- [Git Workflow](./git-workflow.md)
- [Contributing](./CONTRIBUTING.md)
- [Release Guide](./release-guide.md)
- [Diagram Notes](./diagram.md)
- [Answer Evaluation Heuristics](./Answer%20Evaluation%20Heuristics.md)

## Recommended Reading Order

1. **[development-guide.md](./development-guide.md)** — local setup and day-to-day commands.
2. **[architecture.md](./architecture.md)** — package boundaries and runtime flow.
3. **[modes.md](./modes.md)** — behavior differences across Socratic, Guided, and Standard.
4. **[manual-testing.md](./manual-testing.md)** — QA and validation flow.
5. **[implementation-plan.md](./implementation-plan.md)** — execution scope and sequencing.

## Repo Surfaces

- `packages/core` — shared orchestration runtime used by all coding surfaces.
- `packages/cli` — terminal interaction layer.
- `packages/vscode` — VS Code extension integration.
- `apps/landing` — marketing/landing site.

## Notes

- Keep docs in sync with code changes.
- Prefer updating the relevant focused document instead of adding duplicated guidance.
- Place screenshots and visual resources in `docs/resources/`.
