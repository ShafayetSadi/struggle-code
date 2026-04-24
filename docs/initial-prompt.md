# Task: Initialize the Struggle AI Monorepo

> Status: completed scaffold baseline
>
> This document is the original scaffold prompt used to initialize the repository. It is preserved as a historical artifact and reference for why the monorepo is shaped the way it is.
>
> For current day-to-day development, use:
>
> - [docs/development-guide.md](/home/shafayetsadi/Projects/friction-hackathon/docs/development-guide.md)
> - [docs/implementation-plan.md](/home/shafayetsadi/Projects/friction-hackathon/docs/implementation-plan.md)
>
> Notes from execution:
>
> - The scaffold described here has been implemented.
> - `packages/core/src/config.ts` remained environment-agnostic by design, so filesystem reads were left to the CLI instead of core.
> - `apps/landing` currently uses webpack-backed Next scripts for compatibility in restricted environments.
> - The repo now includes a working build, lint, typecheck, and test pipeline across all workspaces.

You are setting up a TypeScript monorepo for a hackathon project called **Struggle AI**. This is a foundational scaffolding task — you are NOT implementing product features. Your job is to produce a clean, compiling, lintable monorepo skeleton that four developers will pick up and build in parallel starting immediately after you finish.

Read this entire prompt before writing any code. Plan before you act.

## Project Context (What You're Building Toward)

Struggle AI is a Socratic coding mentor delivered as (a) a CLI and (b) a VS Code extension, both backed by a shared TypeScript core. It uses scaled friction to teach comprehension — refusing to generate code until the developer can articulate what they're building. The product has three friction modes (Socratic, Guided, Standard), produces Architecture Decision Records (ADRs) per module, maintains a Learning Trail, and tracks an Understanding Score.

For this initialization task, you do not need to implement any of that. You are only building the skeleton with stable public APIs and meaningful stub implementations.

## Architectural Non-Negotiables

**1. Three-layer architecture.** The core package knows nothing about terminals, webviews, or any environment. CLI and VS Code extension both consume core as a library and supply their own implementation of a small `IO` interface.

**2. No imports leak across layer boundaries.** Core must not `import` from `commander`, `chalk`, `pi-tui`, `vscode`, `process.stdout`, `fs/promises`, or anything environment-specific. It accepts an `IO` object and calls methods on it.

**3. Stubs must be useful.** Every stub returns realistic mock data so developers building the CLI and Extension can visually test their UIs immediately. `null` returns, `throw new Error("not implemented")`, and empty arrays are NOT acceptable.

**4. Public API is sacred.** Everything in `packages/core/src/index.ts` is the stable contract. Internal modules can change freely; the public exports cannot (without explicit team-lead approval).

---

## Required Monorepo Layout

```
struggle-ai/
├── packages/
│   ├── core/                 @struggle-ai/core          (TypeScript library)
│   ├── cli/                  @struggle-ai/cli           (Node CLI binary)
│   └── vscode/               struggle-ai-vscode         (VS Code extension, VSIX output)
├── apps/
│   └── landing/              Next.js 15 App Router site
├── .gitignore
├── .npmrc
├── biome.json
├── package.json              Root workspace config
├── tsconfig.base.json        Shared TypeScript config
├── tsconfig.json             Project references root
└── README.md
```

---

## Tech Stack Requirements

- **Runtime:** Node.js 20+ (set `"engines": { "node": ">=20" }` at root)
- **Package manager:** npm with workspaces (NOT pnpm or yarn)
- **Language:** TypeScript 5.x with strict mode everywhere
- **Module system:** ESM (`"type": "module"` in all package.jsons)
- **Lint/format:** Biome (single tool replacing Prettier + ESLint)
- **Build:** `tsc` for packages/core and packages/cli; esbuild for packages/vscode; Next.js internal for apps/landing
- **Test:** Vitest (set up but tests will be added by developers; scaffold one passing test per package)

### LLM Provider Dependencies

Install these in `packages/core`:

- `@mariozechner/pi-ai` — unified multi-provider LLM API
- `@mariozechner/pi-agent-core` — agent runtime (reserved for future use in Phase 2 unlocked execution; do not invoke from core logic yet, but install it so it's available)

Install these in `packages/cli` only:

- `@mariozechner/pi-tui` — terminal UI library
- `commander` — argument parsing

Install `pi-agent-core` in `packages/core` dependencies but do NOT import it anywhere yet. Just make it available.

Use the latest published versions of all `@mariozechner/*` packages — fetch from npm registry.

### Other Key Dependencies

- `packages/core`: `uuid`, `zod` (for runtime validation of config)
- `packages/cli`: `commander`, `chalk` (fallback if pi-tui integration gets complex)
- `packages/vscode`: `vscode` (devDep, types only), `esbuild` (devDep)
- `apps/landing`: `next@latest`, `react@latest`, `react-dom@latest`, `tailwindcss`, `@radix-ui/react-*` (base primitives), `clsx`, `lucide-react`

---

## Phase 1: Monorepo Foundation

Create the root-level files:

### `package.json` (root)

```json
{
  "name": "struggle-ai",
  "private": true,
  "version": "0.1.0",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "check": "biome check .",
    "format": "biome format --write .",
    "lint": "biome lint .",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "tsc --build",
    "dev:cli": "npm run dev --workspace @struggle-ai/cli",
    "dev:landing": "npm run dev --workspace landing",
    "dev:vscode": "npm run dev --workspace struggle-ai-vscode"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

### `tsconfig.base.json`

Strict settings; ES2022 target; NodeNext module resolution. Paths not aliased (we use workspaces).

### `tsconfig.json` (root)

Project references pointing to each package.

### `biome.json`

2-space indent, 120 column width, semicolons, double quotes, trailing commas (ES5 style), `recommended` rules enabled.

### `.gitignore`

Node standard + `dist/`, `.next/`, `*.vsix`, `.DS_Store`, `.env*`, `node_modules/`.

### `.npmrc`

`legacy-peer-deps=false`
`engine-strict=true`

### `README.md`

Short — project name, one-paragraph description, "Packages" table, "Quick start" with `npm install` and `npm run build`, link to the master plan (placeholder).

---

## Phase 2: Core Package (`packages/core`)

This is the most important package. Get it right; the rest is easy.

### `packages/core/package.json`

Name: `@struggle-ai/core`. Type: module. Main: `./dist/index.js`. Types: `./dist/index.d.ts`. Scripts: `build` (tsc), `test` (vitest run), `dev` (tsc --watch).

### `packages/core/src/types.ts`

Copy these types verbatim — these are the stable API contract:

```typescript
export type Mode = "socratic" | "guided" | "standard";
export type Intent = "quick_help" | "debug" | "project";
export type Provider = "anthropic" | "google" | "openai";

export interface ProviderConfig {
  provider: Provider;
  model: string;           // e.g., "claude-sonnet-4-5", "gemini-2.5-flash", "gpt-4o"
  apiKeyEnv: string;       // name of env var, not the key itself
}

export interface SessionState {
  id: string;
  projectPath: string;
  mode: Mode;
  understandingScore: number;  // 0-100
  activeMilestone?: string;
  activeSubProblem?: string;
  sharedFiles: string[];
  createdAt: string;
  lastActive: string;
}

export type TrailEntryType =
  | "session_start"
  | "user_turn"
  | "ai_response"
  | "mode_change"
  | "file_share"
  | "milestone_start"
  | "milestone_complete"
  | "sub_problem_start"
  | "sub_problem_complete"
  | "comprehension_check"
  | "explain_it_back"
  | "adr_generated"
  | "stuck_session"
  | "hint"
  | "bypass"
  | "session_end";

export interface TrailEntry {
  id: string;
  timestamp: string;
  type: TrailEntryType;
  mode: Mode;
  intent?: Intent;
  payload: unknown;
}

export interface ADR {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  concepts: string[];       // "Concepts You Should Know" (3 bullets max)
  risks: string[];          // "What Could Break" (2 scenarios max)
  docLinks: string[];       // Real URLs from allowlisted sources only
  createdAt: string;
}

export interface SubProblem {
  id: string;
  description: string;
  questions: string[];
  resolved: boolean;
  order: number;
}

export type ResponseChunk =
  | { kind: "text"; value: string }
  | { kind: "code"; language: string; value: string }
  | { kind: "adr"; adr: ADR }
  | { kind: "question"; text: string; awaitsInput: true }
  | { kind: "checkpoint"; label: string; kind2: "comprehension" | "explain_it_back" }
  | { kind: "sub_problem"; subProblem: SubProblem };

export interface IO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;
  notify(level: "info" | "warn" | "error", message: string): void;
  stream(chunk: string): void;  // for live streaming display
}
```

### `packages/core/src/io.ts`

Define a default no-op `IO` implementation (`NoopIO`) that developers can use for testing. Every method returns reasonable defaults.

### `packages/core/src/llm/adapter.ts`

This wraps `@mariozechner/pi-ai`. Export:

```typescript
export interface LLMAdapter {
  complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string>;
  stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string>;
}

export function createLLMAdapter(config: ProviderConfig): LLMAdapter;
```

Implementation: route to `pi-ai` based on `config.provider`. Support all three: `anthropic`, `google`, `openai`. Read the API key from `process.env[config.apiKeyEnv]`. If the env var is missing, throw a clear error (`Missing API key: set ${config.apiKeyEnv} in your environment`).

**Important:** Check the actual `@mariozechner/pi-ai` README and public API when implementing this. Use the npm view command or fetch the package's README to confirm the exact API shape. Do not guess — if the API isn't clear from examining the package, scaffold a minimal wrapper with a TODO comment and flag it for human review.

### `packages/core/src/config.ts`

Default config per provider:

```typescript
export const DEFAULT_CONFIGS: Record<Provider, ProviderConfig> = {
  anthropic: { provider: "anthropic", model: "claude-sonnet-4-5", apiKeyEnv: "ANTHROPIC_API_KEY" },
  google:    { provider: "google",    model: "gemini-2.5-flash",  apiKeyEnv: "GOOGLE_API_KEY" },
  openai:    { provider: "openai",    model: "gpt-4o",            apiKeyEnv: "OPENAI_API_KEY" }
};
```

Also: a `resolveProviderConfig` function that auto-detects which provider to use based on available env vars (checks `ANTHROPIC_API_KEY` first, then `GOOGLE_API_KEY`, then `OPENAI_API_KEY`), and a `loadConfig(configPath?: string)` function that reads from `~/.struggle-ai/config.json` if it exists.

### `packages/core/src/index.ts` — The Public API

Export these functions with MEANINGFUL STUB IMPLEMENTATIONS:

```typescript
export async function classifyIntent(message: string): Promise<Intent> {
  // STUB: keyword-based classifier so CLI/Extension can demo immediately
  const lower = message.toLowerCase();
  if (/build|create|make|project|app|website|system/.test(lower)) return "project";
  if (/error|bug|why.*not.*work|broken|fail|throw|exception/.test(lower)) return "debug";
  return "quick_help";
}

export interface Session {
  state: SessionState;
  sendMessage(message: string): AsyncIterable<ResponseChunk>;
  setMode(mode: Mode): void;
  shareFile(path: string): Promise<void>;
  invokeStuck(): AsyncIterable<ResponseChunk>;
  invokeHint(level: 1 | 2 | 3): AsyncIterable<ResponseChunk>;
  exportTrail(outputPath: string, format: "md" | "pdf"): Promise<void>;
  getTrail(): TrailEntry[];
  getADRs(): ADR[];
}

export async function startSession(
  projectPath: string,
  io: IO,
  config?: ProviderConfig
): Promise<Session>;

// Re-export types
export * from "./types.js";
```

Implement `startSession` as a stub that returns a working Session object where:

- `sendMessage("help me build X")` yields a realistic stream: an opening text chunk ("Before we write code — who's the reader here?"), then a `{ kind: "question", ... }` chunk. Use `setTimeout` + `async function*` to simulate streaming with small delays (~30ms between chunks).
- `setMode` updates `state.mode` and logs a `mode_change` trail entry.
- `shareFile(path)` appends to `state.sharedFiles` and logs a `file_share` entry.
- `invokeStuck()` yields three mock question chunks then a mock text answer.
- `invokeHint(level)` yields a text chunk whose content depends on `level`.
- `exportTrail` writes a simple mock Markdown file via the `IO.writeFile`.
- `getTrail()` returns an in-memory array of entries accumulated during the session.
- `getADRs()` returns 1–2 mock ADRs with realistic-looking content.

The stubs should feel like using the real product. Someone running the CLI or Extension against these stubs should see believable output. Fake it well.

### `packages/core/src/prompts/README.md`

A placeholder README explaining that system prompts will live in this folder as `.md` files, loaded at runtime. Do not create prompt files yet — that's Dev B's work.

### Test

One Vitest test file `packages/core/test/classifier.test.ts` with ~3 assertions that the stub `classifyIntent` returns correct labels for obvious inputs. Passes.

---

## Phase 3: CLI Package (`packages/cli`)

### `packages/cli/package.json`

Name: `@struggle-ai/cli`. `bin: { "struggle": "./dist/index.js" }`. Depends on `@struggle-ai/core`, `@mariozechner/pi-tui`, `commander`, `chalk`.

### `packages/cli/src/index.ts`

Use `commander` to define:

- Default command (no args): launch interactive REPL — but for scaffolding, just print `"Struggle AI CLI v0.1.0 — REPL coming soon"` and exit cleanly
- `struggle config set-provider <provider>` — writes to `~/.struggle-ai/config.json` (implement this fully; it's simple)
- `struggle config show` — prints current config (implement this fully)
- `struggle trail export [--format md]` — calls `core.Session.exportTrail`; for now prints "No active session" since REPL isn't built

### `packages/cli/src/ioImpl.ts`

Implement the `IO` interface for CLI: `readFile` uses `fs/promises`, `writeFile` same, `fileExists` uses `fs.access`, `notify` uses `chalk` colors on stderr, `stream` writes to `process.stdout` without newlines.

### Shebang

First line of `dist/index.js` (and `src/index.ts`) must be `#!/usr/bin/env node`.

### Test

One Vitest test that imports the CLI entry without errors.

### Verification

After build, `npx @struggle-ai/cli --help` prints commander help. `npx @struggle-ai/cli` prints the "coming soon" message.

---

## Phase 4: VS Code Extension (`packages/vscode`)

### `packages/vscode/package.json`

Extension manifest with `name: "struggle-ai-vscode"`, `displayName: "Struggle AI"`, `engines.vscode: "^1.85.0"`, `main: "./dist/extension.js"`, one activation event (`"onCommand:struggle.start"`), one command (`struggle.start: "Struggle AI: Start Session"`), and one view container contribution in the activity bar with a tree view (`struggle.trailView: "Learning Trail"`).

Build with esbuild (bundle the extension into a single CJS file). Script: `build` runs esbuild, `dev` runs esbuild --watch.

### `packages/vscode/src/extension.ts`

On `activate`, register the `struggle.start` command. The command should create a basic webview panel titled "Struggle AI" with an HTML body that says "Struggle AI — hello world. Chat UI coming soon." and a simple input/send button (UI non-functional — Dev C will build this out).

Also register the tree data provider for `struggle.trailView` that shows a placeholder item: "No trail entries yet. Start a session to begin."

### `packages/vscode/src/ioImpl.ts`

Implement `IO`: `readFile` via `vscode.workspace.fs`, `writeFile` same, `notify` via `vscode.window.showInformationMessage` / `showWarningMessage` / `showErrorMessage`, `stream` posts messages to the active webview via `webview.postMessage`.

### Do NOT

- Do NOT implement the real chat UI with React, Tailwind, or any framework. Plain HTML placeholder only.
- Do NOT call `@struggle-ai/core`'s `startSession` yet. The extension just needs to compile and activate.

### Verification

`npm run build --workspace struggle-ai-vscode` produces `dist/extension.js`. Running "Run Extension" (F5) in VS Code dev host launches a new window where `Cmd/Ctrl+Shift+P → "Struggle AI: Start Session"` opens the placeholder panel.

---

## Phase 5: Landing Page (`apps/landing`)

### Scaffold

Next.js 15 App Router with TypeScript, Tailwind CSS 4, shadcn/ui initialized (use `npx shadcn@latest init` equivalent — or manually add `components.json`, `lib/utils.ts`, and base `button`, `card` components from shadcn).

### `apps/landing/app/page.tsx`

A single-page layout with:

1. **Hero section:** project name "Struggle AI", tagline placeholder `"[tagline to be written by Dev D]"`, install command block `npm install -g @struggle-ai/cli` with a copy button, and a disabled "Watch demo" button (demo video URL pending).
2. **Three placeholder sections** with `TODO:` comments for: Manifesto, How It Works (three beats), Three Modes (Socratic / Guided / Standard) — each section is a `<section>` tag with a heading and placeholder paragraph.
3. **Footer** with placeholder team credits.

Apply dark mode (Tailwind `dark:` classes) by default. Use shadcn/ui Button and Card primitives.

### `apps/landing/package.json`

Name: `landing`. Scripts: `dev`, `build`, `start`. Standard Next.js scripts.

### Verification

`npm run dev --workspace landing` starts Next.js on `http://localhost:3000`. Page loads without errors, hero section renders, copy button is clickable.

---

## Phase 6: Final Verification

After all phases, run these commands from the repo root. All must pass:

```bash
npm install                    # Installs all workspaces
npm run typecheck              # All packages typecheck
npm run check                  # Biome passes
npm run build                  # All packages build
npm run test                   # All Vitest tests pass
```

Then manually verify:

- `npx @struggle-ai/cli --help` prints commander help output
- `npm run dev --workspace landing` serves the landing page
- Opening `packages/vscode` in VS Code and pressing F5 launches the extension dev host, and the "Struggle AI: Start Session" command opens the placeholder panel

Fix any failures before finishing.

---

## Strict Boundaries — Do NOT Do Any of These

1. **Do not write any real system prompts.** The `prompts/` folder gets a README only.
2. **Do not implement the actual Socratic logic.** Classifier is keyword-based; `sendMessage` yields pre-scripted mock chunks. No real LLM calls in the flow yet.
3. **Do not build the real chat UI in the extension.** Plain HTML placeholder.
4. **Do not write landing page copy.** Use `TODO:` placeholders.
5. **Do not record a demo video or create any video assets.**
6. **Do not publish to npm or VS Code Marketplace.**
7. **Do not initialize git or create commits.** Assume the developer will handle version control.
8. **Do not add GitHub Actions, CI/CD, or workflow files.**
9. **Do not add features beyond this spec.** No `/stuck`, no `/hint`, no `/share`, no real mode logic. Those are developer tasks.
10. **Do not skip stubs.** Every exported function in `@struggle-ai/core` returns a meaningful mock.

## Acceptance Criteria

When you report completion, the following must be true:

- [ ] Repo root has all required config files (package.json, tsconfig.base.json, biome.json, .gitignore, .npmrc, README.md)
- [ ] Four workspaces exist: `packages/core`, `packages/cli`, `packages/vscode`, `apps/landing`
- [ ] `npm install` succeeds from repo root
- [ ] `npm run typecheck` passes
- [ ] `npm run check` (Biome) passes with zero errors
- [ ] `npm run build` succeeds and produces `dist/` outputs
- [ ] `npm run test` runs (at least one passing test per package)
- [ ] CLI entry `npx @struggle-ai/cli` runs without crashing
- [ ] VS Code extension compiles to `packages/vscode/dist/extension.js`
- [ ] Landing page runs under `npm run dev --workspace landing`
- [ ] `packages/core/src/types.ts` matches the type definitions in this spec exactly
- [ ] LLM adapter in `packages/core/src/llm/adapter.ts` routes to Anthropic, Google, and OpenAI via pi-ai
- [ ] All stubs return realistic mock data, not null or errors

## Reporting

When finished, print a summary including:

1. Final directory tree (up to 3 levels deep)
2. Total files created
3. Any deviations from this spec and why
4. Any flagged TODO items where you weren't confident about the pi-ai API shape
5. Exact commands developers should run next to verify the scaffold

Now begin. Plan first, then execute. If anything in this spec is ambiguous or has multiple valid interpretations, pause and ask concise clarifying questions before implementing. Do not make unilateral decisions on ambiguous requirements. After clarification, proceed and note any assumptions explicitly in your final report.
