# @struggle-ai/cli

Terminal interface for Struggle AI. This package wraps `@struggle-ai/core` with an interactive REPL, slash commands, local config management, and terminal-oriented rendering for learning sessions.

## Requirements

- Node.js 20+
- One configured provider API key

Supported environment variables:

- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY` or `GEMINI_API_KEY`
- `OPENAI_API_KEY`

## Install

From the monorepo root:

```bash
npm install
npm run build --workspace packages/cli
```

## Quick Start

Start the REPL in the current directory:

```bash
npm exec --workspace packages/cli struggle
```

Or point it at a specific project:

```bash
npm exec --workspace packages/cli struggle -- --project /path/to/project
```

Set a default provider:

```bash
npm exec --workspace packages/cli struggle -- config set-provider anthropic
npm exec --workspace packages/cli struggle -- config show
```

## REPL Commands

- `/help` shows every supported slash command
- `/mode <guided|standard|full-socratic>` switches session mode
- `/share <path>` adds a file to the active session context
- `/stuck` triggers a stuck-session intervention
- `/hint [1|2|3]` asks for a hint; omitted level auto-increments per milestone
- `/trail export [path] [--format md|pdf]` writes the current trail
- `/exit` quits the REPL

## Rendering Behavior

- text streams inline from core
- code chunks render as highlighted terminal blocks
- questions render with a distinct prompt marker
- ADRs render as a compact terminal summary
- checkpoints render as section dividers

## Notes

- Trail export currently writes Markdown even when `--format pdf` is requested; core emits a warning for that path.
- The package is still marked `"private": true` in [`package.json`](./package.json).
