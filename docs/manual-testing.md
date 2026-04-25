# Manual Testing Guide

Shared manual QA flow for the whole team. Use this file so everyone runs the same commands, tests the same paths, and reports bugs in the same format.

## Important

Use the local workspace CLI, not the published npm package.

Do this:

```bash
npm exec --workspace packages/cli struggle -- --project /tmp/struggle-fastapi-demo
```

Do not do this:

```bash
npx @struggle-ai/cli --project /tmp/struggle-fastapi-demo
```

`npx @struggle-ai/cli` may pull a published version that does not contain the latest local fixes.

## Preflight

Run these from the repo root:

```bash
npm run check
npm run build
npm run test
```

Set one real provider before running the CLI:

```bash
export ANTHROPIC_API_KEY=your_real_key_here
```

Or use an account-backed provider:

```bash
npm exec --workspace packages/cli struggle -- config login openai-codex
npm exec --workspace packages/cli struggle -- config set-provider openai-codex
```

Optional config setup:

```bash
npm exec --workspace packages/cli struggle -- config set-provider anthropic
npm exec --workspace packages/cli struggle -- config list-models anthropic
npm exec --workspace packages/cli struggle -- config set-model claude-sonnet-4-5
npm exec --workspace packages/cli struggle -- config show
```

Create the test project directory:

```bash
mkdir -p /tmp/struggle-fastapi-demo
```

Start the local CLI:

```bash
npm exec --workspace packages/cli struggle -- --project /tmp/struggle-fastapi-demo
```

If you do not already have a usable provider configured, the CLI should prompt for provider selection and login before the REPL opens.

## Test Flow A: Guided Happy Path

Inside the REPL, run this exact sequence:

```text
/help
Help me build a blogging website with FastAPI
An author publishes posts for readers.
They draft, preview, and publish posts from one dashboard.
Posts and tags persist in a database, auth is simple email login, and deployment is one FastAPI service with one database.
This milestone defines the first publishing flow because the user needs one narrow working path, the boundary stays simple, and the main test should cover draft to published state.
/hint
/stuck
/share app/main.py
/trail export
/trail notes
/trail adr
/exit
```

### Expected Results

- CLI starts in `guided` mode
- `/help` shows every supported slash command
- design interview asks one question at a time
- REPL shows a clearer progress line like `Question 1 of 5`
- after enough interview answers, the session emits:
  - milestone text
  - a code chunk
  - a checkpoint divider
- after the comprehension answer, an ADR appears
- `/hint` returns without crashing
- `/stuck` returns without crashing
- `/share app/main.py` confirms the path was shared
- `/trail export` writes a file path under `/tmp/struggle-fastapi-demo/.struggle-ai/`
- `/trail notes` writes a notes file under `/tmp/struggle-fastapi-demo/.struggle-ai/`
- `/trail adr` writes an ADR file under `/tmp/struggle-fastapi-demo/.struggle-ai/`

## Test Flow B: Guided Meta-Question Guard

This confirms the interview does not swallow confused user input as design answers.

Use this exact sequence:

```text
Help me build a blogging website with FastAPI
An author publishes posts for readers.
what is this bug
```

### Expected Results

- the session should not treat `what is this bug` as the answer to the current design question
- it should say you are still in the scoping interview
- it should re-ask the current design question
- the interview should stay on the same step

## Test Flow C: Mode Switching Smoke Test

Start a fresh CLI session or continue in the current one:

```text
/mode standard
Build auth
A user should be able to sign in and reach a protected dashboard.
/mode socratic
Help me build JWT auth
```

### Expected Results

- `/mode standard` updates the prompt mode label
- standard mode asks one clarification question, then generates code/checkpoint output
- `/mode socratic` updates the prompt mode label
- socratic emits at least one `sub-problem` style response

## Test Flow D: Trail Export Check

After any meaningful session, run:

```text
/trail export
```

Then verify on disk:

```bash
find /tmp/struggle-fastapi-demo/.struggle-ai -maxdepth 1 -type f | sort
```

Open the generated file and check for:

- `# Struggle AI Learning Trail`
- `## Transcript`
- `## ADRs`
- exported turns from the session you just ran

## Bug Report Format

When you find a bug, post it in this format:

```text
Title:
Short description of the bug

Area:
CLI | Core | Prompt | VSCode | Landing

Branch:
git branch name

Commit:
git rev-parse --short HEAD

Environment:
Node version
Provider used

Steps to reproduce:
1.
2.
3.

Expected:

Actual:

Crash output or screenshot:

Severity:
blocker | high | medium | low
```

## Release Gate

Before demo prep or publish prep, run:

```bash
npm run check
npm run build
npm run test
```

Then run the local workspace CLI smoke test:

```bash
npm exec --workspace packages/cli struggle -- --project /tmp/struggle-fastapi-demo
```

If manual testing fails, fix the bug first and re-run the relevant flow from this file.
