# Git Workflow

This repo uses a simple staged flow:

1. create feature branches from `dev`
2. open feature PRs into `dev`
3. after `dev` is ready, open a release PR from `dev` into `main`

## Branch Flow

```text
main
  ^
  |
 dev
  ^
  |
feature/<name>
```

## Feature Work

Start from the latest `dev` branch:

```bash
git checkout dev
git pull origin dev
git checkout -b feature/short-description
```

Do your work, then commit normally:

```bash
git add .
git commit -m "feat: add session trail renderer"
git push -u origin feature/short-description
```

Open a pull request:

- base branch: `dev`
- compare branch: `feature/short-description`

## Merge to `dev`

Use `dev` as the integration branch for active work.

- merge feature PRs into `dev`
- keep feature branches small and focused
- make sure checks pass before merging

## Promote `dev` to `main`

When `dev` is stable and ready for release:

```bash
git checkout dev
git pull origin dev
git push origin dev
```

Then open a pull request:

- base branch: `main`
- compare branch: `dev`

After that PR is reviewed and merged, `main` becomes the released baseline.

## Recommended Rules

- do not branch from `main` for normal feature work
- do not open feature PRs directly to `main`
- keep `main` protected and release-ready
- sync your feature branch with `dev` if it gets stale

## Quick Summary

```text
dev -> create feature branch
feature branch -> PR to dev
dev -> PR to main
```
