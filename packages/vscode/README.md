# Struggle AI - VS Code Extension

A Socratic coding mentor that now runs a real shared-core session inside VS Code instead of a placeholder panel.

## Prerequisites

Configure the CLI first. The extension reads the same saved provider config and OAuth/API-key auth:

```bash
npm install
npm run build --workspace packages/cli
npm exec --workspace packages/cli struggle -- config show
```

If you have not configured a provider yet, do that from the CLI first:

```bash
npm exec --workspace packages/cli struggle -- config set-provider anthropic
```

## Features

- Chat panel backed by the real `@struggle-ai/core` session runtime
- Learning Trail sidebar with live trail entries and ADRs
- Mode switching for `guided`, `standard`, and `socratic`
- Quick actions for hint, stuck-session prompts, sharing the active file, and trail export
- Slash commands in the editor panel: `/help`, `/mode`, `/hint`, `/stuck`, `/share`, `/trail export`

## Usage

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Struggle AI: Start Session**
3. Ask a question about the current workspace
4. Use the quick actions or slash commands when you want the extension flow to mirror the CLI

## Shared Config

The extension reads the same config files as the CLI:

- `~/.struggle-ai/config.json`
- `~/.struggle-ai/auth.json`

If the provider or login is missing, configure it from the CLI first.
