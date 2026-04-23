# Struggle AI — Master Implementation Plan v2.0

## Status Snapshot

This plan began as the build target for the initial scaffold. The scaffold phase is now complete, and the repo contains the baseline monorepo structure, core stubs, CLI shell, VS Code extension shell, landing page scaffold, tests, and root verification scripts.

Current companion docs:

- [docs/development-guide.md](/home/shafayetsadi/Projects/friction-hackathon/docs/development-guide.md) for active engineering workflow
- [docs/initial-prompt.md](/home/shafayetsadi/Projects/friction-hackathon/docs/initial-prompt.md) for the original scaffold brief

Scaffold reality notes:

- The monorepo foundation described in this plan exists in the repo today.
- `packages/core` remains environment-agnostic; config file IO is owned by callers such as the CLI.
- The landing app currently uses webpack-backed Next scripts instead of Turbopack in local scripts to avoid restricted-environment build issues.
- The VS Code extension is intentionally still a placeholder shell, matching the original phased plan.

Recommended reading order for a new contributor:

1. Read this plan for product intent and ownership.
2. Read the development guide for actual repo workflow and package boundaries.
3. Inspect the current public core contract in [packages/core/src/index.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/index.ts) and [packages/core/src/types.ts](/home/shafayetsadi/Projects/friction-hackathon/packages/core/src/types.ts).

**Team:** 4 developers, each with Claude Code / Codex paid subscriptions
**Build Window:** 48 hours active build + 24 hours polish/video/submission
**Hackathon:** Noverse FRICTION 2026 (Apr 23 00:00 BST → Apr 26 00:00 BST)
**Deliverables:** CLI (npm package) + VS Code Extension (VSIX) + Landing Page (Vercel) + 2-min Demo Video
**Product name:** Struggle AI

---

## Part I — Merged Feature Scope

### 1.1 What We're Building (One-Sentence Pitch)

**Struggle AI is a coding mentor that refuses to be a code vending machine — available as a CLI and a VS Code extension — that uses scaled friction to teach comprehension while you build.**

### 1.2 Three Friction Modes (The Core UX)

Absorbed from teammate's proposal. Mode is user-selectable per project.

| Mode | Friction Level | Flow |
| --- | --- | --- |
| **Full Socratic** | High | Request → decompose into 3–5 sub-problems → 2–3 Socratic questions per sub-problem → evaluate answers → tiny code chunk generated → Explain-It-Back checkpoint → next sub-problem |
| **Guided** | Medium | Design interview → AI writes milestone → user answers comprehension question → ADR auto-generated → next milestone |
| **Standard** | Low | Brief design clarification → AI scaffolds code → user fills body OR AI writes + mandatory digest → ADR auto-generated |

Default mode on first launch: **Guided**. Users switch via `/mode full-socratic | guided | standard`.

### 1.3 Core Features (MVP — all modes unless noted)

| # | Feature | CLI | Extension |
| --- | --- | --- | --- |
| F1 | Three-mode friction selector | ✅ | ✅ |
| F2 | Intent classifier (quick_help / debug / project) | ✅ | ✅ |
| F3 | Design Interview state machine | ✅ | ✅ |
| F4 | Milestone loop with per-mode behavior | ✅ | ✅ |
| F5 | Sub-problem decomposition (Full Socratic only) | ✅ | ✅ |
| F6 | Explain-It-Back checkpoint | ✅ | ✅ |
| F7 | ADR auto-generation per module | ✅ | ✅ |
| F8 | "Concepts You Should Know" + "What Could Break" structured outputs | ✅ | ✅ |
| F9 | Real documentation URL allowlist (MDN, docs.python.org, etc.) | ✅ | ✅ |
| F10 | Understanding Score tracker | ✅ | ✅ |
| F11 | Learning Trail append-only log | ✅ | ✅ |
| F12 | Trail export to Markdown | ✅ | Stretch |
| F13 | `/share <path>` user-pulled file access | ✅ | Auto (via VS Code workspace API) |
| F14 | `/stuck` 4-question diagnostic | ✅ | ✅ |
| F15 | `/hint` graduated 3-level hints | ✅ | Stretch |
| F16 | Side-by-side demo mode (Standard AI vs Socratic) | Stretch | Stretch |

### 1.4 Non-Goals (Hard Cuts)

- No automatic mode transitions based on detected comprehension
- No team features, dashboards, accounts, or cloud sync
- No autonomous file reading in CLI (pull-only via `/share`)
- No custom model support beyond Anthropic + Google
- No multi-language UI (English only)
- No Windows-native CLI (WSL2 only for MVP)

---

## Part II — Three-Layer Architecture

This is the single most important decision of the build. Everything depends on it holding.

### 2.1 Package Structure (npm workspaces)

```
struggle-ai/
├── packages/
│   ├── core/                    @struggle-ai/core
│   │   ├── src/
│   │   │   ├── index.ts         Public API exports
│   │   │   ├── types.ts         Shared types (SessionState, Mode, TrailEntry, ADR, etc.)
│   │   │   ├── gate/
│   │   │   │   ├── classifier.ts
│   │   │   │   ├── designInterview.ts
│   │   │   │   ├── socratic.ts
│   │   │   │   └── explainItBack.ts
│   │   │   ├── modes/
│   │   │   │   ├── fullSocratic.ts
│   │   │   │   ├── guided.ts
│   │   │   │   └── standard.ts
│   │   │   ├── artifacts/
│   │   │   │   ├── adr.ts
│   │   │   │   ├── trail.ts
│   │   │   │   └── understandingScore.ts
│   │   │   ├── llm/
│   │   │   │   └── adapter.ts   Wraps pi-ai
│   │   │   ├── prompts/         Externalized .md files
│   │   │   └── io.ts            IO interface — CLI/Extension provide impl
│   │   └── package.json
│   │
│   ├── cli/                     @struggle-ai/cli
│   │   ├── src/
│   │   │   ├── index.ts         commander entry
│   │   │   ├── repl.ts          Interactive session loop
│   │   │   ├── renderer.ts      pi-tui rendering
│   │   │   ├── commands/
│   │   │   │   ├── share.ts
│   │   │   │   ├── stuck.ts
│   │   │   │   ├── hint.ts
│   │   │   │   ├── mode.ts
│   │   │   │   └── trail.ts
│   │   │   └── ioImpl.ts        CLI implementation of core.io
│   │   └── package.json
│   │
│   └── vscode/                  struggle-ai-vscode (VSIX)
│       ├── src/
│       │   ├── extension.ts     activate(), commands
│       │   ├── chatPanel.ts     Webview host
│       │   ├── sidebarView.ts   Trail + ADR view
│       │   ├── webview/         React app (chat UI)
│       │   └── ioImpl.ts        Extension implementation of core.io
│       └── package.json
│
├── apps/
│   └── landing/                 Next.js 15 app
│       ├── app/
│       └── package.json
│
├── package.json                 Root workspace config
└── README.md
```

### 2.2 The Core Contract (The Most Important Code)

The `core` package exposes a clean TypeScript API. CLI and Extension call it identically. Define these in the first 2 hours:

```typescript
// packages/core/src/types.ts
export type Mode = "full-socratic" | "guided" | "standard";
export type Intent = "quick_help" | "debug" | "project";

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

export interface TrailEntry {
  id: string;
  timestamp: string;
  type: TrailEntryType;
  mode: Mode;
  payload: unknown;
}

export interface ADR {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  concepts: string[];       // "Concepts You Should Know"
  risks: string[];          // "What Could Break"
  docLinks: string[];       // Allowlisted URLs only
  createdAt: string;
}

export interface IO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  notify(level: "info" | "warn" | "error", message: string): void;
  stream(chunk: string): void;
}

// packages/core/src/index.ts — PUBLIC API
export async function classifyIntent(message: string): Promise<Intent>;
export async function startSession(projectPath: string, io: IO): Promise<Session>;

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

export type ResponseChunk =
  | { kind: "text"; value: string }
  | { kind: "code"; language: string; value: string }
  | { kind: "adr"; adr: ADR }
  | { kind: "question"; text: string; awaitsInput: true }
  | { kind: "checkpoint"; label: string };
```

**Rule: Everything else in the codebase is implementation detail. Only this API is stable.** Anyone building CLI or Extension writes against these types from hour 2 onward, even if the implementation is a stub returning mocks.

### 2.3 The IO Pattern (Why It Enables Parallel Work)

Core never imports `fs`, `process.stdout`, `chalk`, `pi-tui`, or any environment-specific module. It accepts an `IO` object and calls methods on it.

- **CLI's IO impl:** reads from `fs`, writes to stdout via pi-tui, notifies with ANSI colors
- **Extension's IO impl:** reads via `vscode.workspace.fs`, writes to webview via `postMessage`, notifies with `vscode.window.showInformationMessage`

This is the reason one developer can build the extension in parallel with the CLI. They're both shells around the same core.

---

## Part III — Team Roles & Ownership

You have 4 developers. Assignments below are designed so that each owns a full vertical slice with minimal hard dependencies on others.

### 3.1 Role Summary

| Role | Primary deliverable | Skills needed |
| --- | --- | --- |
| **Dev A — Core Lead** | `@struggle-ai/core` package | Strong TS, architecture sense, prompt engineering |
| **Dev B — CLI Engineer** | `@struggle-ai/cli` + prompts | TS, CLI/terminal comfort, pedagogy instinct |
| **Dev C — Extension Engineer** | `struggle-ai-vscode` VSIX | TS, VS Code extension API, webview / React |
| **Dev D — Landing & Demo** | Landing page + demo video | Next.js, Tailwind, UI/UX, video editing |

### 3.2 Who Should the Team Lead Be?

**You (the team lead) should be Dev A — Core Lead.** Reason: the core is the bottleneck that unblocks everyone else. If core slips, everyone slips. You need the person with the strongest architectural sense and full decision authority on that track. You also stay closest to Dev B (co-located on CLI work) and serve as the integration point for Dev C.

If you strongly prefer another role, designate someone else as Core Lead — but whoever takes core needs to treat the shared API contract (Section 2.2) as sacred.

### 3.3 Role Details

#### Dev A — Core Lead (also the team lead)

**Owns:**
- `@struggle-ai/core` package
- Shared types and API contract
- LLM adapter (pi-ai wrapper)
- All three mode engines
- Gate logic (classifier, design interview, Socratic, Explain-It-Back)
- Artifact generators (ADR, Trail, Understanding Score)

**Doesn't touch:** CLI REPL UI, Extension webview, Landing page.

**Why this role is critical:** Every other track is blocked without the API contract (hours 0–2) and working stub implementations (hour 8). Dev A must be aggressive about publishing stubs early and refining them continuously.

#### Dev B — CLI Engineer

**Owns:**
- `@struggle-ai/cli` package
- All prompt engineering (system prompts for each mode + gate)
- CLI REPL loop + slash command dispatch
- pi-tui rendering integration
- Trail export command implementation

**Doesn't touch:** Core logic internals (but writes against core's API), Extension, Landing.

**Why pair prompts + CLI:** Prompts are heavily CLI-flavored (the text output format matters most in the terminal). Whoever writes the prompts should feel them render in the CLI and iterate.

#### Dev C — Extension Engineer

**Owns:**
- `struggle-ai-vscode` VSIX
- Chat panel webview (HTML + CSS + JS, or React inside webview)
- Sidebar view for Trail + ADRs
- Mode toggle UI
- Integration with `@struggle-ai/core`

**Doesn't touch:** CLI, Core internals (uses the API), Landing.

**Scope reality check:** The extension MVP is **minimal by design**. It demonstrates "the core ports cleanly" — not "every CLI feature exists here." Ship Guided mode only, chat panel only, with Trail/ADR viewer. Full Socratic + Standard modes are stretch. `/stuck` and `/hint` are buttons in the chat UI, not separate commands.

#### Dev D — Landing & Demo

**Owns:**
- `apps/landing` Next.js site
- Landing page copy + design
- Asciinema recordings (coordinated with Dev B)
- Demo video script, recording, editing
- Submission form copy (`anything_else_to_say`)

**Doesn't touch:** Anything in `packages/*`.

**Why this is a full-time role:** The landing page is the first thing judges see. The demo video is what they remember. A UI/UX expert who can iterate on copy, layout, and video pacing without needing backend context is exactly who you want here. Do not assign them to Extension or Core work — you will waste their best skills.

---

## Part IV — 48-Hour Build Roadmap

### 4.1 Phase Overview

```
H0────H4────H8────H16───H24───H32───H40───H48
│     │     │     │     │     │     │     │
│Kick-│Found│Core  │Paral│Integ│Polish│Final│ →→ H48-72:
│off +│ation│stubs │lel  │ration│& QA │push │    landing
│prompt│     │ready │build │      │     │     │    video
│start │     │(all  │ends  │      │     │     │    submit
│      │     │unblkd)│     │      │     │     │
```

### 4.2 Phase 1 — Kickoff & Foundation (Hours 0–4)

**Entire team, synchronous.**

| H | Activity | Who | Output |
| --- | --- | --- | --- |
| 0:00–0:30 | Kickoff call: confirm product name, review this plan, commit to it | All | Alignment |
| 0:30–1:00 | Repo setup: npm workspaces scaffolded, packages skeleton, CI basic | Dev A | Repo live on GitHub |
| 1:00–2:00 | Define shared types + API contract in `packages/core/src/types.ts` and `index.ts` | Dev A | Types merged to main |
| 1:00–2:00 | Start prompt engineering in Claude web UI (parallel) | Dev B | Draft prompts emerging |
| 1:00–2:00 | Scaffold VS Code extension with `yo code`, hello-world command | Dev C | Extension compiles |
| 1:00–2:00 | Scaffold Next.js + Tailwind + shadcn, deploy empty to Vercel | Dev D | Landing URL live |
| 2:00–4:00 | Dev A publishes stub `@struggle-ai/core@0.0.1` with mock functions | Dev A | Stubs installable |
| 2:00–4:00 | Dev B continues prompt engineering — Guided mode end to end | Dev B | `guided.md` prompt done |
| 2:00–4:00 | Dev C builds chat panel webview shell, mock message flow | Dev C | Webview renders, buttons work |
| 2:00–4:00 | Dev D builds hero section + manifesto + install command block | Dev D | Above-fold looks real |

**Checkpoint at H4:** API contract stable, stubs installable. If not, extend Phase 1 by 2 hours.

### 4.3 Phase 2 — Parallel Build (Hours 4–24)

Everyone works against the stable API. Dev A is filling in real implementations; Dev B and C can use stubs until real impl arrives, then swap.

| H | Dev A (Core) | Dev B (CLI) | Dev C (Extension) | Dev D (Landing) |
| --- | --- | --- | --- | --- |
| 4–8 | LLM adapter via pi-ai, streaming working, classifier implementation | Finish prompts for all modes, CLI REPL loop with commander, pi-tui integrated | Chat panel React UI, streaming response display, input field + send | Three-beats "How It Works" section with placeholder asciinema |
| 8–12 | Design Interview state machine, Guided mode milestone generator | `/mode` command, dispatch user messages to core, Guided mode demo works | Mode toggle UI, integrate `@struggle-ai/core` actual package (not stub) | "Three modes" explainer section with diagrams |
| 12–16 | Full Socratic mode (sub-problem decomp + Explain-It-Back), Standard mode | `/share` command with path validation and binary detection | Sidebar view for current Trail (simple list) | Record first asciinema clips with Dev B (Guided mode walkthrough) |
| 16–20 | ADR generator, Understanding Score tracker, Trail append-only engine | `/stuck` 4-question flow, `/hint` 3-level system | ADR viewer in sidebar, polish chat UX | Embed asciinema clips, content polish, start video script draft |
| 20–24 | Trail export to Markdown, allowlisted doc URL filter | Trail export command, prompts round-2 tuning based on real runs | Final extension polish, VSIX packaging test, install from VSIX works | Landing page 90% complete, responsive design tested on mobile |

**Checkpoint at H24:** CLI runs a full end-to-end Guided mode demo cleanly. Extension runs the same flow. This is the product's "moment of truth."

### 4.4 Phase 3 — Integration & Polish (Hours 24–40)

Shift from parallel to convergent work. Bug hunting, prompt tuning, demo preparation.

| H | Activity | Owners |
| --- | --- | --- |
| 24–28 | **Full-team walkthrough call**: Run CLI demo + Extension demo end-to-end. Log every bug, prompt glitch, UX friction into shared issues list. | All |
| 28–32 | Bug bash: Dev A + B fix CLI issues. Dev C fixes extension. Dev D starts polishing landing page with real product footage. | All, parallel |
| 32–36 | Prompt tuning round 2: Dev A + B refine system prompts based on real session feedback. Record final asciinema clips of polished flows. | Dev A + B + D |
| 36–40 | Dev C packages extension as VSIX, writes installation README. Dev D finalizes landing page with embedded sample Learning Trail + final asciinema. Dev A + B write CLI README and publish to npm (test channel). | All |

**Checkpoint at H40:** Everything works. Feature freeze. The next 8 hours are for video and submission.

### 4.5 Phase 4 — Final Push: Video & Submission (Hours 40–48)

| H | Activity | Owners |
| --- | --- | --- |
| 40–42 | Finalize demo video script. Record voiceover. Capture screen for side-by-side comparison (Cursor vs Struggle AI). | Dev D + Dev B (narration) |
| 42–45 | Video edit: cuts, captions (Kosmyna MIT citation, key claims), title card, closing line. | Dev D primary |
| 45–46 | Upload to YouTube (unlisted initially, make public at submission). | Dev D |
| 46–47 | Write submission `anything_else_to_say` — 3 crisp sentences about stance, CLI+Extension strategy, Noverse alignment. Fresh-install smoke test on a clean VM. | Dev A + Dev D |
| 47–48 | Submit. Screenshot confirmation. Celebrate. | All |

---

## Part V — Detailed Task Division (Hour-by-Hour)

### 5.1 Dev A — Core Lead (You, the Team Lead)

**Sleep window:** H20–H28 (8 hours). Dev B covers.

| Hours | Task | Deliverable |
| --- | --- | --- |
| 0–1 | Kickoff, repo setup, npm workspaces | Repo scaffolded |
| 1–2 | Define `types.ts` and `index.ts` API surface in core | Committed |
| 2–4 | Write stub implementations — all functions return mock data | `@struggle-ai/core@0.0.1-stub` installable locally |
| 4–6 | Implement `pi-ai` adapter with streaming | LLM calls work |
| 6–8 | Implement intent classifier | `classifyIntent()` returns correct labels on 10 test inputs |
| 8–12 | Implement Design Interview state machine + Guided mode milestone loop | End-to-end FastAPI blog design conversation works |
| 12–16 | Implement Full Socratic mode (sub-problem decomposition + Explain-It-Back) | Demo: "Build JWT auth" → 4 sub-problems → questions → code per sub-problem |
| 16–20 | Implement Standard mode + ADR generator | Each completed milestone produces an ADR with all required fields |
| **20–28** | **Sleep** | — |
| 28–32 | Bug fixes from H24 walkthrough, prompt refinement based on real runs | Issues closed |
| 32–36 | Allowlisted doc URL filter, Understanding Score computation, Trail export engine | All artifacts correct |
| 36–40 | CLI README, core package README, publish core to npm (test) | Packages installable |
| 40–44 | Support Dev D in demo video — technical accuracy review, narration | Video rough cut approved |
| 44–48 | Submission: fresh install test on clean VM, write `anything_else_to_say` note, final submit | Submitted |

### 5.2 Dev B — CLI Engineer

**Sleep window:** H28–H36 (8 hours). Dev A covers post-sleep.

| Hours | Task | Deliverable |
| --- | --- | --- |
| 0–1 | Kickoff, setup, pull repo | Dev env ready |
| 1–4 | Prompt engineering in Claude web UI — Guided mode system prompt end-to-end | `prompts/guided.md` polished |
| 4–8 | CLI REPL with commander, pi-tui integrated, stub core calls | `struggle` command launches and responds |
| 8–12 | Wire `/mode` command, dispatch to stub core, swap to real core as Dev A delivers | All three modes selectable |
| 12–16 | `/share <path>` with validation (binary detection, path traversal guard) | File sharing works and logs to trail |
| 16–20 | `/stuck` 4-question state machine, `/hint` graduated 3-level system | Commands functional end-to-end |
| 20–24 | Trail export command, prompt tuning round 1 based on real runs | Export produces GitHub-renderable Markdown |
| 24–28 | Bug bash with rest of team, integrate fixes from walkthrough | Issues closed |
| **28–36** | **Sleep** | — |
| 36–40 | Final CLI polish, README, error message pass | CLI feels professional |
| 40–44 | Record asciinema clips for video with Dev D | Clips captured |
| 44–48 | Narration for video, final QA, submission support | Video complete |

### 5.3 Dev C — Extension Engineer

**Sleep window:** H24–H32 (8 hours) OR H16–H24 if the earlier window serves better. Let Dev C choose based on their rhythm.

| Hours | Task | Deliverable |
| --- | --- | --- |
| 0–2 | Kickoff, `yo code` scaffold, hello-world command, VS Code dev host working | Extension compiles and activates |
| 2–4 | Chat panel webview shell with HTML+CSS (or React), mock message display | Webview renders |
| 4–8 | Input field, send button, streaming response rendering (no real LLM yet) | Mock chat works end-to-end |
| 8–12 | Swap stub core → real `@struggle-ai/core`. Implement Extension's IO impl. | Real LLM responses stream in extension |
| 12–16 | Mode toggle UI (dropdown or button bar). Wire to core's `setMode`. | Mode switching works |
| 16–20 | Sidebar view (`TreeDataProvider`) for Trail + ADRs | Trail entries appear in sidebar as they arrive |
| 20–24 | Auto file-share via `vscode.window.activeTextEditor` — send active file to core on demand | File context works |
| **24–32** | **Sleep** | — |
| 32–36 | `/stuck` button in chat UI, error handling, UX polish | Feature complete |
| 36–40 | VSIX packaging, README with install steps, test install on fresh VS Code | VSIX downloadable |
| 40–44 | Record screen captures of extension for demo video | Footage captured |
| 44–48 | Submission support, final testing | Extension in submission |

### 5.4 Dev D — Landing & Demo

**Sleep window:** H16–H24 (8 hours). This is the earliest window to preserve energy for the critical H40–H48 video sprint.

| Hours | Task | Deliverable |
| --- | --- | --- |
| 0–1 | Kickoff, Next.js + Tailwind + shadcn scaffold, deploy empty to Vercel | Landing URL reserved |
| 1–4 | Hero section: product name, one-liner, install command block with copy button, "Watch demo" button (placeholder) | Above-fold looks intentional |
| 4–8 | Manifesto section + three-beats "How It Works" with placeholder diagrams | Content skeleton done |
| 8–12 | Three-modes explainer section with visual differentiation, Kosmyna citation callout | Content complete |
| 12–16 | Mobile responsive pass, dark mode, shadcn component polish | Design 85% done |
| **16–24** | **Sleep** | — |
| 24–28 | Integrate real asciinema clips from Dev B, real sample Learning Trail embedded as Markdown | Content 100% done |
| 28–32 | Copy polish, SEO meta tags, OG image for social sharing | Landing feels shippable |
| 32–36 | Demo video script draft. Coordinate with Dev A/B for technical beats. | Script approved |
| 36–40 | Storyboard video: side-by-side Cursor vs Struggle AI, mode demos, ADR reveal, Learning Trail on GitHub | Shots planned |
| 40–44 | Record video: screen capture, narration (Dev B voice preferred), B-roll | Raw footage |
| 44–47 | Edit: cuts, captions, citations on screen, title card, closing line | Video polished |
| 47–48 | Upload YouTube, update landing page, submission support | Live |

---

## Part VI — Anti-Blocking Strategies

Parallel work fails when people wait on each other. These five rules prevent that.

### 6.1 Code Against Interfaces, Not Implementations

By hour 2, the core's public API (`packages/core/src/index.ts`) is locked and exports stub functions. Everyone else codes against those function signatures — they never wait for real implementations.

### 6.2 Stubs Return Useful Mock Data

Dev A's hour 2–4 stubs don't return `null` or throw. They return plausible mock `ResponseChunk` streams, mock ADRs, mock SessionStates. This lets Dev B and Dev C test their UIs meaningfully before real logic arrives.

### 6.3 Daily Sync: 3-Minute Standup Every 6 Hours

At H6, H12, H18, H24, H30, H36, H42: quick voice sync on what's done, what's blocked, what's changed in the contract. If the contract has changed, Dev A broadcasts the diff immediately.

### 6.4 Contract Changes Are the Team Lead's Responsibility

If Dev C needs a new method on the core, they request it from Dev A. Dev A is the only person who adds to or changes the API surface. This avoids merge hell.

### 6.5 Pair on Hard Integration Points

When Dev C first swaps from stub core to real core (around hour 8–10), Dev A pairs with them live for 30 minutes. Same when Dev B wires `/share` to core. Cheap insurance against wasted hours.

---

## Part VII — Using Claude Code / Codex Effectively

Since every team member has a paid subscription, use it strategically. Not every task is improved by AI.

### 7.1 Tasks Where AI Shines

- **Scaffolding boilerplate:** `yo code` extension setup, Next.js page layouts, commander command definitions, type declarations — let AI generate these.
- **Well-specified functions with clear inputs/outputs:** path validation, binary detection, Markdown rendering, Trail → Markdown converter. Give Claude Code the type signatures and tests.
- **UI components:** shadcn+Tailwind landing page sections, webview chat bubble components, React state management.
- **Test fixtures:** sample user messages for classifier testing, sample ADRs for trail rendering tests.
- **Documentation:** READMEs, install guides, code comments.

### 7.2 Tasks Where AI Wastes Time

- **Prompt engineering.** Iterate by *feel*, in a plain Claude web UI. Don't have Claude Code write your system prompts — judge the output yourself.
- **Integration debugging.** When the extension webview doesn't receive messages, you have to read the stack yourself. AI guesses badly at environmental issues.
- **Architecture decisions.** The three-layer structure, the IO pattern, the choice of streaming vs request/response — these are human judgment calls.
- **Demo video pacing.** AI cannot tell you if a beat lands. You need human eyes.

### 7.3 Team Rule

**No unreviewed AI-generated commits.** Every PR, even AI-assisted, gets reviewed by at least one teammate before merge. This is meta-on-theme: you're building a tool that says *"understand the code you ship."* Practice what you preach.

---

## Part VIII — Decision Gates

At each gate, meet briefly and decide GO / PIVOT / CUT. Don't let the build drift — decisions are cheaper the earlier they're made.

### Gate 1 — Hour 4: Foundation Check
- **GO if:** API contract committed, stubs installable, all four scaffolds compiling
- **PIVOT if:** Any of the above missing — extend Phase 1, compress later
- **CUT if:** Repo setup broken — switch to simpler monorepo (single package with folder split)

### Gate 2 — Hour 12: Core Feel Check
- **GO if:** Guided mode works end-to-end on Dev A's machine with a real LLM call
- **PIVOT if:** Only stubs working — Dev A abandons Standard and Full Socratic, doubles down on Guided only
- **CUT if:** LLM integration failing — fall back to direct Anthropic SDK, skip pi-ai

### Gate 3 — Hour 24: Scope Freeze
- **GO if:** End-to-end FastAPI blog demo runs cleanly in CLI, extension shows one mode working
- **PIVOT if:** One of CLI or Extension isn't ready — that track drops to MVP-minimum, other track absorbs polish time
- **CUT if:** Both lagging — cut Full Socratic and Standard modes, ship only Guided in both CLI and Extension

### Gate 4 — Hour 40: Video Go Decision
- **GO if:** All three deliverables (CLI, Extension, Landing) working cleanly, video script approved
- **PIVOT if:** Extension buggy — demo as "architecturally ready, see roadmap" instead of live in video
- **CUT if:** Video script not ready — record raw asciinema walkthrough with voice-over, skip heavy edit

### Gate 5 — Hour 46: Final Ship Check
- **GO if:** All URLs work, submission form can be filled confidently
- **PIVOT if:** Any deliverable broken — submit with honest note in `anything_else_to_say`
- Do not miss the H48 deadline. Submit with whatever is working.

---

## Part IX — Critical Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Dev A's core is late → everyone blocked | Medium | Critical | Stubs at H4 are non-negotiable. If Dev A is behind, Dev B pairs on core. |
| Extension webview message-passing is buggy | Medium | High | Dev C starts with the simplest possible webview (HTML+CSS, no React) to get messages flowing, then upgrades |
| Prompt quality is below mentor bar | High | Critical | Time-box prompt work to 8h max with Dev B. Reuse teammate's Planner/Coder prompt structure from proposal as starting template. |
| VSIX doesn't install on judge's machine | Low | Medium | Publish to open-vsx.org during H36–H40, provide one-line install in README |
| Three modes is too much in 48h | Medium | Medium | Gate 3 cuts modes — Guided mode alone is a complete product |
| Demo video runs long (>2 min) | Medium | Medium | Script at H36, record at H40, leaves time for recut. |
| Sleep deprivation degrades quality at H40+ | High | High | Enforce sleep windows. No exceptions. |
| Power outage in Rajshahi | Medium (this is real) | Medium | At least two team members have mobile hotspots pre-configured. |

---

## Part X — Submission Checklist (Hour 47–48)

Pin this checklist in your chat. Cross off live:

- [ ] `hosted_project_url` works in incognito (Vercel landing)
- [ ] `source_code_url` repo public on GitHub
- [ ] `demo_video_url` public on YouTube, under 2:00
- [ ] CLI installs via `npm install -g @struggle-ai/cli` on a fresh machine
- [ ] VSIX installs via VS Code "Install from VSIX" on a fresh machine
- [ ] Landing page contains: install command, three-modes explainer, sample Learning Trail embed, demo video embed, GitHub link
- [ ] README at repo root explains: what it is, how to install CLI, how to install extension, how to run a session
- [ ] Sample Learning Trail committed to a demo repo linked from landing
- [ ] `anything_else_to_say` note written (3 crisp sentences)
- [ ] Battle pass code entered
- [ ] Team name matches registered team
- [ ] Confirmation screenshot saved

---

## Part XI — The Pitch (Submission Note)

Draft for `anything_else_to_say` — refine with your team:

> Struggle AI is our stance: vibe-coders ship code, engineers ship understanding. We built it as both a CLI (for terminal workflows) and a VS Code extension (for editor workflows) on a shared core — proving that scaled friction can port across surfaces without rewriting logic. The three friction modes (Full Socratic, Guided, Standard) let developers choose their own level; the Learning Trail + ADRs make comprehension a first-class engineering artifact. With more time, we'd wrap Cursor and Claude Code as friction layers — but the architecture already allows it.

---

## Part XII — Closing Notes for the Team Lead

You're the bottleneck by design. That's the cost of owning the core — everyone depends on you being present, decisive, and available to unblock. Three things matter more than the code you write:

1. **Respond within 15 minutes to API contract questions.** Dev B and Dev C will hit edges of the types you defined. Decide fast. Write it down.
2. **Defend the scope freeze at Hour 24.** Feature creep is the #1 killer of parallel teams. If someone pitches "one small addition" after H24, the answer is *"post-hackathon, yes. Right now, no."*
3. **Ship over perfection.** A CLI with two working modes + an extension with one working mode + a great landing page + a 2-minute video beats a CLI with three polished modes and nothing else.

The team that wins this hackathon won't be the one with the most features. It'll be the one with the clearest stance and the most credible execution. You have both within reach.

Now — kickoff call, confirm everyone's in, and press go.

---

*End of Master Implementation Plan v2.0.*
