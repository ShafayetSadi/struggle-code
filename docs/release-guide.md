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

## Use The Local CLI

Use the workspace CLI while developing so you run the code from this repo, not the latest package from npm.

Build the CLI and core package:

```bash
npm run build --workspace @struggle-ai/core
npm run build --workspace @struggle-ai/cli
```

Run the local CLI:

```bash
npm exec --workspace @struggle-ai/cli struggle -- --help
```

Run it against a project:

```bash
npm exec --workspace @struggle-ai/cli struggle -- --project /path/to/project
```

Check the saved provider config:

```bash
npm exec --workspace @struggle-ai/cli struggle -- config show
```

Set the provider before testing CLI or VS Code flows:

```bash
npm exec --workspace @struggle-ai/cli struggle -- config set-provider anthropic
```

Use the same `npm exec --workspace @struggle-ai/cli struggle -- ...` pattern for other CLI commands during local testing.

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

1. Update `packages/cli/package.json` version to a version that has never been published before.
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

### npm publish fails because the version already exists

npm package versions are immutable. If `npm run publish:cli` fails with an error like this:

```text
You cannot publish over the previously published versions: 0.1.2.
```

it means `@struggle-ai/cli@0.1.2` is already on npm. You must bump the CLI version before publishing again.

For a normal bug fix or small code change, bump the patch version:

```bash
npm version patch --workspace @struggle-ai/cli
```

For a new backwards-compatible feature, bump the minor version:

```bash
npm version minor --workspace @struggle-ai/cli
```

For a breaking change, bump the major version:

```bash
npm version major --workspace @struggle-ai/cli
```

Then publish again:

```bash
npm run publish:cli
```

You can check the latest published version before choosing the next version:

```bash
npm view @struggle-ai/cli version
```

## Publish To The VS Code Marketplace

When new VS Code extension code should be released:

1. Update `packages/vscode/package.json` version to a version that has never been published before.
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

### VS Code Marketplace publish fails because the version already exists

VS Code extension versions are immutable in the Marketplace. If `npm run publish:vscode` fails with an error like this:

```text
TonmayHossainJifat.struggle-ai-vscode v0.1.0 already exists.
```

it means version `0.1.0` of the extension has already been published. You must bump `packages/vscode/package.json` before publishing again.

For a normal bug fix or small code change, bump the patch version:

```bash
npm version patch --workspace struggle-ai-vscode
```

For a new backwards-compatible feature, bump the minor version:

```bash
npm version minor --workspace struggle-ai-vscode
```

For a breaking change, bump the major version:

```bash
npm version major --workspace struggle-ai-vscode
```

Then publish again from the repo root:

```bash
npm run publish:vscode
```

Use the repo script instead of running `npx @vscode/vsce publish` from the repo root. The root `package.json` is not a VS Code extension package, so `vsce` will fail there with an error like this:

```text
Missing vscode engine compatibility version.
```

If you need to run `vsce` directly, change into the extension package first:

```bash
cd packages/vscode
npx @vscode/vsce publish --no-dependencies
cd ../..
```

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
