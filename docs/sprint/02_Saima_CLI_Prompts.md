# Saima — CLI Engineer + Prompt Engineer

**Your role:** CLI Engineer, co-owner with Sadi. Primary owner of prompts (the text) and the terminal user experience.
**Primary package:** `packages/cli`
**Secondary:** Prompt files in `packages/core/src/prompts/*.md` (you write the content; Sadi wires them up)
**Sleep window:** H28–H36 (8 hours). You cover CLI during Sadi's sleep (H20–H28).

---

## Your Prime Directive

Your code lives in `packages/cli/`. You import `@socrates-ai/core` and build the terminal experience around it. You do **not** touch `packages/core/` directly — if you need a new core function, ask Sadi in team chat.

Two parallel responsibilities:
1. **Build the CLI REPL, commands, and terminal rendering** using pi-tui + commander.
2. **Write the system prompts** that go into `packages/core/src/prompts/*.md` — iterating them in a plain Claude web UI first, then committing them for Sadi to wire up.

The prompts are the product's personality. If they feel like a drill sergeant, we lose users in 30 seconds. If they feel like a thoughtful senior engineer, we win the hackathon.

---

## Context You Must Read First

Spend the first 30 minutes after kickoff reading:
- `05_MasterImplementationPlan_v2.md` — Parts I (Scope), IV (Roadmap), Part V.5.2 (your specific timeline)
- `packages/core/src/types.ts` — every type you'll see when consuming the core API
- `packages/core/src/index.ts` — the public functions you'll call
- The existing scaffold's `packages/cli/src/index.ts` and `ioImpl.ts` — the commander structure and IO implementation

---

## Prompt Engineering — Your Most Important Work

The prompts matter more than the code. Read this section twice.

### The Mentor Vibe Test

Every prompt must make the AI respond like **a thoughtful senior engineer doing a code review**, not:
- A drill sergeant ("answer the question before I help you")
- A lecturer ("let me explain what a Promise is in detail...")
- A cheerleader ("Great question!")
- A Stack Overflow moderator ("did you even try to Google this?")

Read every response out loud. If it sounds like any of the above, rewrite.

### Prompt Engineering Workflow

For each prompt:
1. Open Claude Sonnet 4.5 in the web UI (claude.ai)
2. Set a system prompt and paste a sample user message
3. Read the response out loud
4. Rewrite the system prompt, try again
5. Repeat until 3 different sample user messages all produce mentor-vibe responses
6. Commit the final prompt to `packages/core/src/prompts/<name>.md`
7. Tell Sadi in chat: "Prompt `<name>.md` is ready, wire it up."

Do NOT iterate prompts by rebuilding and running the CLI each time. Too slow. Web UI first, always.

### Prompts You Own

| Prompt file | What it does | When Sadi needs it |
| --- | --- | --- |
| `classify.md` | 1-shot intent classifier | H4–H6 |
| `quick-help.md` | Socratic response to concept questions | H6–H8 |
| `debug.md` | Hypothesis-first debugging | H8–H10 |
| `design-interview.md` | 5-question project scoping | H6–H10 |
| `guided-milestone.md` | Generate one working code milestone | H10–H14 |
| `comprehension-check.md` | Evaluate user's comprehension answer (pass/probe) | H10–H14 |
| `adr-generator.md` | Generate structured ADR after milestone | H14–H17 |
| `standard-mode.md` | Lower-friction mode flow | H28–H32 |
| `full-socratic-decompose.md` | Decompose request into 3–5 sub-problems | H32–H36 |
| `full-socratic-questions.md` | Generate 2–3 Socratic questions per sub-problem | H32–H36 |
| `explain-it-back.md` | End-of-sub-problem checkpoint | H32–H36 |
| `stuck-diagnostic.md` | Guide through the 4-question flow | H20–H24 |
| `hint-L1.md` / `hint-L2.md` / `hint-L3.md` | Graduated hints | H24–H28 |

Sadi will tell you which prompts he needs first based on what he's implementing. Don't work on all of them in order — follow his signal.

### Prompt Quality Checklist (Every Prompt)

Before committing, each prompt must:
- [ ] Open with the AI's role in 1 sentence ("You are a Socratic coding mentor...")
- [ ] List 3–6 numbered rules the AI must follow
- [ ] Include at least one "DO" and one "DON'T" example
- [ ] Specify output format if structured (JSON, Markdown, etc.)
- [ ] Be under 500 words total (LLMs ignore long prompts)
- [ ] Pass the mentor vibe test on 3 test inputs

---

## Hour-by-Hour Task List

### Phase 1 — Kickoff & Foundation (H0–H4)

| Hour | Task | Dependency |
| --- | --- | --- |
| 0:00–0:30 | Kickoff call with team | Sadi |
| 0:30–1:00 | Verify scaffold: `npm install && npm run build` succeeds on your machine | Scaffold done |
| 1:00–2:00 | Read `packages/core/src/types.ts` + `index.ts`. Run `npx @socrates-ai/cli` and explore the stub output. | Scaffold done |
| 2:00–4:00 | Open Claude Sonnet 4.5 web UI. Start drafting `classify.md` and `design-interview.md` prompts — these are Sadi's first needs. | None |

**Checkpoint at H4:** You have drafts of `classify.md` and `design-interview.md` that pass the mentor vibe test on 3 sample inputs.

### Phase 2 — Parallel Build (H4–H20)

#### Track A: CLI REPL (your code)

| Hour | Task | Dependency |
| --- | --- | --- |
| 4–6 | Build the interactive REPL loop in `packages/cli/src/repl.ts`. Calls `core.startSession()`, accepts stdin, dispatches slash commands or messages. Use pi-tui for rendering. | None — stubs work |
| 6–8 | Wire `/mode <mode>` command. Calls `session.setMode(mode)`. Updates the REPL prompt display (e.g., `socrates [guided] ›`). | None — stubs work |
| 8–10 | Stream response rendering. When `session.sendMessage()` yields chunks, render each `ResponseChunk` kind differently: text streams inline, `code` chunks get syntax highlighting (pi-tui or chalk fallback), `question` chunks show a distinct prompt and block for input, `adr` chunks render as a boxed summary, `checkpoint` chunks show a divider. | None — stubs work |
| 10–12 | Wire `/share <path>` command. Calls `session.shareFile(path)`. Display a confirmation line. | None — stubs work |
| 12–14 | Wire `/stuck` command. Calls `session.invokeStuck()` and streams the response. | None — stubs work |
| 14–16 | Wire `/hint` command with auto-incrementing level. Track current hint level per milestone in the REPL state. | None — stubs work |
| 16–18 | Wire `/trail export` command. Calls `session.exportTrail()`. Print the output path. | Sadi's trail export real at H20 |
| 18–20 | Error handling pass. Every `catch` in the REPL must display a useful message via `io.notify("error", ...)` and return to the prompt. | None |

#### Track B: Prompts (you iterate these in parallel to CLI work)

| Hour | Task | Hand-off to Sadi at |
| --- | --- | --- |
| 4–6 | Finalize `classify.md` (already drafted) + `quick-help.md` | H6 |
| 6–10 | Finalize `design-interview.md` + `debug.md` | H8 / H10 |
| 10–14 | Finalize `guided-milestone.md` + `comprehension-check.md` | H14 |
| 14–17 | Finalize `adr-generator.md` | H17 |
| 17–20 | Draft `stuck-diagnostic.md` + `hint-L1/L2/L3.md` | H20 |

**Checkpoint at H20:** CLI demo runs Guided mode end-to-end. You can run `socrates` in a test project and complete a FastAPI blog design conversation, get a milestone, answer comprehension, see the ADR. This is the product's moment of truth — if this works, the hackathon is winnable.

### Phase 3 — Cover Sadi + Finish Prompts (H20–H28)

Sadi is sleeping. You're the senior technical person awake.

| Hour | Task |
| --- | --- |
| 20–22 | Final polish on CLI REPL: every error path handled, streaming looks smooth, slash commands all discoverable via `/help`. |
| 22–24 | Integration test: run the full FastAPI blog demo end-to-end. Fix any bugs in CLI code. For core bugs, file an issue with clear reproduction and Sadi will address post-sleep. |
| 24–26 | Finalize `standard-mode.md` prompt (Sadi's H28 target). |
| 26–28 | Start drafting `full-socratic-decompose.md` and related prompts. |

**If Jifat or Arif pings with a core question during this window:** Triage it. If simple (a type question, a function signature), answer directly. If substantive, log it for Sadi and unblock them with a workaround.

### Phase 4 — Sleep (H28–H36)

Hard sleep. Phone on for team emergencies only.

### Phase 5 — Integration & Polish (H36–H40)

| Hour | Task |
| --- | --- |
| 36–37 | Full-team walkthrough. Take notes on CLI UX issues. |
| 37–39 | CLI bug bash. Fix everything on the list. |
| 39–40 | CLI README: clear install, quick-start, example commands. Test on a fresh machine/VM if possible. |

### Phase 6 — Demo Support (H40–H48)

| Hour | Task |
| --- | --- |
| 40–44 | Record asciinema clips with Arif. You run the CLI; Arif captures. Multiple takes until pacing is clean. |
| 44–46 | Record voiceover narration for the demo video with Arif (your voice is preferred if you're a stronger narrator than Sadi — coordinate at H40). |
| 46–48 | Final QA, submission support. |

---

## Your Blocking Dependencies

| I am blocked by | On what | Until when | Workaround |
| --- | --- | --- | --- |
| Sadi | Real `classifyIntent()` | H6 | Use stub; CLI still functional |
| Sadi | Real Guided mode in `sendMessage()` | H14 | Stub returns mock milestones; wire UI now, test real data later |
| Sadi | Real `getTrail()` | H20 | Stub returns mock entries; `/trail export` won't produce meaningful output until then, but the command itself works |
| Sadi | Real `exportTrail()` | H20 | Same as above |

**Key insight:** Because the scaffold's stubs return realistic mock data, you can build ALL your CLI code from H4 onward without waiting. You're never actually blocked during the build phase.

## Who Is Blocked By You

| Blocked | What they need | By when | Risk if late |
| --- | --- | --- | --- |
| Sadi | `classify.md` prompt | H6 | Sadi can't wire real classifier |
| Sadi | `design-interview.md` prompt | H10 | Sadi can't build design interview real |
| Sadi | `guided-milestone.md` + `comprehension-check.md` | H14 | Core Guided mode delayed |
| Sadi | `adr-generator.md` | H17 | ADRs stay mock |
| Arif | Clean CLI recording-ready state | H40 | Video demos get delayed |

---

## Critical Rules

1. **Never edit `packages/core/`.** If you need something there, ask Sadi. Exception: prompt files in `packages/core/src/prompts/` are yours to edit directly.
2. **Iterate prompts in the web UI, not by rebuilding the CLI.** This is a 10x speed difference.
3. **Every new slash command needs to be listed in `/help`.** If a judge types `/help`, they should see everything.
4. **The REPL must never crash silently.** Every unhandled exception becomes a test case.
5. **Streaming must feel smooth.** If responses appear in big chunks instead of token-by-token, something's wrong. Check with Sadi.
6. **Your sleep window is non-negotiable.** Sadi is back at H28 and needs you fresh for the integration phase at H36.

---

## Emergency Protocols

**If prompts aren't landing the mentor vibe after 4 hours of iteration:** Post a sample in team chat. Get a second opinion from Sadi or Arif. Sometimes fresh eyes see what you can't.

**If pi-tui integration is broken or unclear:** Fall back to `chalk` for colors and plain `process.stdout` for streaming. Ship working basics; upgrade after core freeze.

**If Sadi is offline and blocking you:** Check if a stub answer is good enough. If not, post clear blocker in team chat with proposed workaround. Unblock yourself with a mock and leave a `// TODO: wire to Sadi's real impl` comment.

---

*Your prompts are the product's voice. Your REPL is how users feel the product. Both are owned by you; both decide whether Socrates AI is a toy or a tool.*
