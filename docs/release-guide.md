# Release Guide

Use this guide when you need to test the VS Code extension locally, publish a new npm CLI build, or publish a new VS Code Marketplace build after code changes land.

Run commands from the repo root unless a step says otherwise.

## Prerequisites

- Node.js 20 or newer
- npm account access for `@struggle-ai/cli`
- Visual Studio Marketplace publisher access for `TonmayHossainJifat`
- VS Code installed for local extension testing

Install dependencies first:

```bash
npm install
```

## Pre-Release Checks

Run these before every npm or VS Code Marketplace publish:

```bash
npm run typecheck
npm run check
npm run build
npm run test
```

Do not publish if any command fails.

## Test The VS Code Extension Locally

Build or watch the extension:

```bash
npm run dev:vscode
```

In another terminal, make sure the CLI and core packages are built:

```bash
npm run build --workspace @struggle-ai/core
npm run build --workspace @struggle-ai/cli
```

Open the extension workspace:

```bash
code packages/vscode
```

Then:

1. Press `F5` in VS Code.
2. A new Extension Development Host window opens.
3. In that new window, run `Struggle AI: Start Session` from the Command Palette.
4. Smoke test the chat panel, Learning Trail view, mode switching, quick actions, and trail export.

The extension depends on the same local Struggle AI config as the CLI:

```bash
npm exec --workspace @struggle-ai/cli struggle -- config show
```

If provider config is missing, configure it through the CLI before testing the extension.

## Test A Packaged VSIX Locally

Use this when you want to verify the same artifact that will be uploaded to the Marketplace:

```bash
npm run build --workspace struggle-ai-vscode
cd packages/vscode
npx @vscode/vsce package --no-dependencies
cd ../..
```

Install the generated `.vsix` in VS Code:

```bash
code --install-extension packages/vscode/struggle-ai-vscode-<version>.vsix
```

Restart VS Code and run `Struggle AI: Start Session`.

## Publish To npm

The public npm package in this repo is `@struggle-ai/cli`. The shared `@struggle-ai/core` package is currently private and is built before publishing the CLI.

When new CLI or shared core code should be released:

1. Update `packages/cli/package.json` version.
2. Update `package-lock.json` by running:

```bash
npm install
```

3. Run the pre-release checks.
4. Make sure you are logged in:

```bash
npm whoami
```

If that fails, log in:

```bash
npm login
```

5. Publish:

```bash
npm run publish:cli
```

That script builds `@struggle-ai/core`, builds `@struggle-ai/cli`, and publishes `@struggle-ai/cli` with public access.

After publishing, verify the published package:

```bash
npm view @struggle-ai/cli version
npx @struggle-ai/cli@latest --help
```

## Publish To The VS Code Marketplace

When new VS Code extension code should be released:

1. Update `packages/vscode/package.json` version.
2. Run the pre-release checks.
3. Test the extension locally with `F5`.
4. Package and install a VSIX locally if the change is user-facing.
5. Make sure Marketplace auth is configured:

```bash
npx @vscode/vsce verify-pat TonmayHossainJifat
```

If authentication is missing, log in with a Marketplace personal access token:

```bash
npx @vscode/vsce login TonmayHossainJifat
```

6. Publish:

```bash
npm run publish:vscode
```

That script builds the `struggle-ai-vscode` workspace, changes into `packages/vscode`, and runs `vsce publish --no-dependencies`.

After publishing, verify the extension page in the Marketplace and install the released extension in a clean VS Code window.

## Release Checklist

Use this checklist every time new code is added and needs to be shipped:

- Decide whether the change affects npm, VS Code Marketplace, or both.
- Bump the relevant package version:
  - npm CLI: `packages/cli/package.json`
  - VS Code extension: `packages/vscode/package.json`
- Run `npm install` after version changes so `package-lock.json` stays current.
- Run `npm run typecheck`.
- Run `npm run check`.
- Run `npm run build`.
- Run `npm run test`.
- Smoke test the VS Code extension locally for extension changes.
- Publish npm with `npm run publish:cli`.
- Publish Marketplace with `npm run publish:vscode`.
- Verify the published npm version with `npm view @struggle-ai/cli version`.
- Verify the Marketplace release by installing the published extension.
