# Struggle AI — VS Code Extension

A Socratic coding mentor that lives inside VS Code. Instead of giving you answers, it guides you through problems with targeted questions so the understanding actually sticks.

## Prerequisites

Install the CLI first — the extension shares its config and API key:

```bash
npm install -g @struggle-ai/cli
struggle config set-provider anthropic --key <your-api-key>
```

## Features

- **Chat panel** — Start a session and get Socratic guidance without leaving your editor
- **Learning Trail sidebar** — Every session is logged as a searchable trail of decisions and ADRs
- **Friction modes** — Guided, Standard, or Full Socratic depending on how much hand-holding you want
- **`/stuck` button** — Four diagnostic questions that help you unblock yourself

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Struggle AI: Start Session**
3. Describe what you're trying to build

## Extension Settings

Configure via the CLI (`struggle config`) or set directly in VS Code settings:

| Setting | Default | Description |
|---|---|---|
| `struggle.provider` | `anthropic` | LLM provider (`anthropic`, `openai`, `google`) |
| `struggle.mode` | `guided` | Default friction mode |
