# Contributing

This guide is for contributors working in the Struggle AI monorepo.

## Before You Start

- Branch from `dev`, not `main`
- Keep changes small and focused
- Prefer updating shared behavior in `packages/core` first when it affects both CLI and VS Code
- Check existing docs before changing product-facing language or workflow descriptions

For the full branch strategy and release flow, see [git-workflow.md](git-workflow.md).
For the full local setup and development commands, see [development-guide.md](development-guide.md).

## Basic Flow

1. Sync `dev` and create a feature branch.
2. Make the smallest useful change.
3. Add or update tests in the package that owns the behavior.
4. Run the relevant checks before handing work off.
5. Open a PR into `dev`.

## Verification

Run these from the repo root before handing work to someone else:

```bash
npm run typecheck
npm run check
npm run build
npm run test
```

If your change affects the CLI or extension flow, do a manual smoke test too.

## Contribution Notes

- Keep `packages/core` environment-agnostic.
- Do not move runtime-specific logic from CLI or VS Code into core unless it belongs to the shared contract.
- Update README or docs when the product story, commands, or workflows change.
- Use conventional commit messages when possible.

## Related Docs

- [README.md](../README.md)
- [development-guide.md](development-guide.md)
- [git-workflow.md](git-workflow.md)
- [manual-testing.md](manual-testing.md)
