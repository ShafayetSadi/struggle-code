# Sadi — Team Lead + Core Implementation Owner

**Your role:** Team Lead, Core Lead, co-owner of CLI with Saima
**Primary package:** `packages/core` (all logic)
**Secondary package:** `packages/cli` (with Saima)
**Sleep window:** H20–H28 (8 hours). Saima covers CLI during this window.

---

## Current Status

This doc started as the build-order plan. It now also acts as the current-state handoff.

Already shipped locally:

- real `classifyIntent()`
- guided interview flow with design brief writing
- guided milestone loop with checkpoint and ADR generation
- trail accumulation and Markdown export
- standard mode and full socratic mode
- `packages/core/README.md`
- regression fix: short meta-input during guided interview should no longer be recorded as a design answer

Recent integration notes:

- use the local workspace CLI for testing: `npm exec --workspace packages/cli struggle -- --project /tmp/struggle-fastapi-demo`
- do not use `npx @struggle-ai/cli` for local QA; that may hit a published package
- shared manual QA is now documented in `docs/manual-testing.md`

What remains on your side:

- run and supervise the shared manual QA flow with a real provider key
- fix integration bugs found in guided, standard, full socratic, trail export, and rendering boundaries
- generate sample ADR and Trail artifacts for Arif
- finish publish prep and submission-day smoke tests

## Your Prime Directive

You are the only person who writes code in `packages/core/`. Everyone else depends on your stubs being replaced with real implementations — one at a time, without breaking the API surface. Your job has three parts, in priority order:

1. **Keep the API contract stable.** Types in `packages/core/src/types.ts` and exports in `packages/core/src/index.ts` are sacred. If you must change them, announce it in the team chat *before* you commit.
2. **Replace stubs with real implementations** in a predictable order (below) so others can swap in real behavior as it ships.
3. **Unblock your teammates.** Answer API questions within 15 minutes. If Jifat or Saima hits an edge case, your work pauses to help them.

You are also the Team Lead. That means running the 3-minute syncs at H6, H12, H18, H24, H30, H36, H42 and defending scope freeze at Gate 3 (H24).

---

## Context You Must Read First

Spend the first 30 minutes after kickoff reading:
- `05_MasterImplementationPlan_v2.md` — Parts II (Architecture), VI (Anti-Blocking), VIII (Decision Gates)
- The scaffold's `packages/core/src/types.ts` — the API surface everyone codes against
- The scaffold's `packages/core/src/llm/adapter.ts` — verify the pi-ai integration is correct; this is your highest-risk piece of scaffolded code
- `@mariozechner/pi-ai` README on npm — confirm you understand the streaming and message API

---

## Hour-by-Hour Task List

### Phase 1 — Kickoff & Verification (H0–H4)

| Hour | Task | Dependency |
| --- | --- | --- |
| 0:00–0:30 | Run kickoff call. Share the master plan + this per-person doc set. Confirm roles, product name, sleep windows. | None |
| 0:30–1:00 | Verify scaffold works on your machine: `npm install && npm run build && npm run test` all pass. | Claude Code scaffold complete |
| 1:00–2:00 | Verify scaffold works on every teammate's machine via shared screen or voice. Fix any platform issues before anyone else starts. | Everyone on call |
| 2:00–3:00 | Read `packages/core/src/llm/adapter.ts`. Test a real LLM call end-to-end by writing a one-off script in `/tmp` that imports it and calls Claude with a real API key. | `ANTHROPIC_API_KEY` in env |
| 3:00–4:00 | Write `packages/core/test/adapter.integration.test.ts` — a Vitest test that makes a real pi-ai call and asserts the adapter works. Gate this behind `if (process.env.RUN_INTEGRATION_TESTS)`. | LLM adapter confirmed |

**Checkpoint at H4:** Everyone's scaffold runs. LLM adapter confirmed working against a real API. You're ready to replace stubs.

### Phase 2 — Core Implementation (H4–H20)

Replace stubs in this specific order. After each one, **announce in the team chat** that the stub is replaced so Saima/Jifat can swap to the real behavior and test it.

#### Block 1: Intent Classifier (H4–H6)

**Replace:** `classifyIntent()` in `packages/core/src/index.ts`

**What to build:** A real LLM-based classifier that takes a user message and returns `quick_help | debug | project`. Use a dedicated system prompt in `packages/core/src/prompts/classify.md`. The prompt should be ~80 words, instructing the model to output exactly one of the three labels and nothing else. Use Claude Sonnet 4.5 with low temperature (0.1).

**Test fixtures:** Add 10 test cases in `packages/core/test/classifier.test.ts`:
- "What's a Promise?" → `quick_help`
- "My useEffect runs twice" → `debug`
- "Help me build a blogging website with FastAPI" → `project`
- etc.

**Announce:** "Classifier is real. Saima/Jifat, you'll now see real classification when users send messages."

#### Block 2: Design Interview State Machine (H6–H10)

**Replace:** The `project` intent path in `sendMessage()` when there's no active milestone yet.

**What to build:** A state machine that asks up to 5 scoping questions (scope+user, data storage, features, auth, deployment) and emits a design doc Markdown file via `io.writeFile()`. State is kept in `SessionState.activeSubProblem` (overloading this field for now — rename post-hackathon).

**Prompt:** `packages/core/src/prompts/design-interview.md` — critical to get the tone right. Iterate this prompt in a plain Claude web UI before writing code.

**Announce:** "Design Interview working. Saima/Jifat, try asking 'Help me build X' — you should see a 5-question design flow."

#### Block 3: Guided Mode Milestone Loop (H10–H14)

**Replace:** The flow that kicks in after Design Interview finishes, when mode is `guided` (the default).

**What to build:**
- After the design doc is written, extract a milestone plan from it
- For each milestone: generate full working code via LLM, stream it to the user via `ResponseChunk`
- After streaming, emit a `{ kind: "checkpoint", kind2: "comprehension" }` chunk that waits for user input
- On user's answer, evaluate with a lightweight LLM call ("does this answer show understanding? respond: pass | probe"); if `probe`, emit a follow-up question; if `pass`, emit the ADR and move to next milestone

**Prompt:** `packages/core/src/prompts/guided-milestone.md` + `packages/core/src/prompts/comprehension-check.md`

**Announce:** "Guided mode works end-to-end. Milestone 1 through ADR, try it with a real design."

#### Block 4: ADR Generator (H14–H17)

**Replace:** Mock ADRs in `getADRs()`.

**What to build:** After each milestone completes, call the LLM with a dedicated prompt to generate a real ADR with all required fields (`title`, `context`, `decision`, `consequences`, `concepts`, `risks`, `docLinks`). Enforce structure with JSON response mode (Claude's `response_format` or instructions + validation).

**Doc link allowlist:** Hardcode a regex allowlist: `^https://(developer\\.mozilla\\.org|docs\\.python\\.org|reactjs\\.org|fastapi\\.tiangolo\\.com|docs\\.djangoproject\\.com|nodejs\\.org|typescriptlang\\.org)/`. Strip any URL that doesn't match. This is non-negotiable — hallucinated doc URLs destroy credibility in the demo.

**Announce:** "ADRs are real. Arif (landing page), you can now render a sample ADR on the landing page. I'll commit a sample one to the demo repo at H22."

#### Block 5: Trail Engine + Export (H17–H20)

**Replace:** In-memory trail accumulation + `exportTrail()` mock.

**What to build:**
- Every `ResponseChunk` emission + every user message + every mode change appends to a trail array in the Session
- `getTrail()` returns the real array
- `exportTrail(path, format)` calls `io.writeFile()` with a real Markdown document containing: header (project, dates, turn count), chronological transcript with syntax-highlighted code blocks, ADRs section, summary footer (concepts encountered, time in each mode, stuck sessions resolved)
- Must render cleanly on GitHub — test by committing a sample to a public repo

**Announce:** "Trail engine real. Arif, I'll push a sample Trail to the demo repo at H22 for you to embed."

### Phase 3 — Sleep + Handoff (H20–H28)

**H20–H20:30:** Write a handoff note in the team chat covering: what's working, what's stubbed, what Saima should watch for. Tell Saima to ping Jifat's questions to Arif to triage (Arif has web context and can triage non-core questions).

**H20–H28:** Sleep. Phone on for emergencies only.

### Phase 4 — Standard + Full Socratic Modes (H28–H36)

#### Block 6: Standard Mode (H28–H32)

**Replace:** Standard mode path when user does `/mode standard`.

**What to build:** Brief one-question design clarification, then full code generation with a mandatory digest step (a question about the code after it's written). ADR still generates. Less friction than Guided; lowest-friction of the three modes.

**Prompt:** `packages/core/src/prompts/standard-mode.md`

#### Block 7: Full Socratic Mode (H32–H36)

**Replace:** Full Socratic path when user does `/mode full-socratic`.

**What to build:** Sub-problem decomposition (3–5 per user request), per-sub-problem Socratic questions (2–3 per sub-problem), answer evaluation against a threshold, minimal code chunks per sub-problem, Explain-It-Back checkpoint at the end.

**Prompts:** `packages/core/src/prompts/full-socratic-decompose.md` + `packages/core/src/prompts/full-socratic-questions.md` + `packages/core/src/prompts/explain-it-back.md`

**If running behind:** Ship with simpler per-sub-problem flow (no answer-quality evaluation, just accept any answer over 10 words). Explain-It-Back can be a simple "tell me what this code does in your own words" with lenient grading.

### Phase 5 — Integration & Polish (H36–H40)

| Hour | Task |
| --- | --- |
| 36–37 | Full-team walkthrough call. You run the demo; others take notes. Capture all bugs and UX glitches in a shared issue list. |
| 37–39 | Core bug bash. Fix everything surfaced in the walkthrough. Prompt tuning round 2 based on real session feedback. |
| 39–40 | Update `packages/core/README.md` with install instructions and quick-start. Publish to npm under `@socrates-ai/core@0.1.0` (or npm equivalent of test channel) so Arif can link from landing page. |

### Updated Next Actions

Ignore the original build-order sections that are already complete. From this point forward, your active checklist is:

1. Run `docs/manual-testing.md` with a real API key using the local workspace CLI.
2. Fix anything that breaks in `packages/core` or the CLI/core boundary.
3. Commit sample ADR and Trail outputs for Arif to embed.
4. Run `npm run check && npm run typecheck && npm run test`.
5. Decide whether to unmark `packages/core` as `"private": true` for publish prep.

### Phase 6 — Video + Submission (H40–H48)

| Hour | Task |
| --- | --- |
| 40–42 | Review Arif's video script for technical accuracy. Dry-run the FastAPI blog demo 3 times until the timing feels right. |
| 42–45 | Narrate voiceover for the demo video (or be on camera if Arif's script needs it). Review Arif's video edits for factual correctness — especially anything citing Kosmyna MIT research. |
| 45–47 | Write the `anything_else_to_say` submission note with Arif. 3 sentences. |
| 47–48 | Fresh install smoke test on a clean VM or Docker container. Submit. Screenshot confirmation. |

---

## Your Blocking Dependencies

| I am blocked by | On what | Until when | Workaround |
| --- | --- | --- | --- |
| (Nothing — you're the root of the dependency tree) | | | |

## Who Is Blocked By You

| Blocked | What they need | By when | Risk if late |
| --- | --- | --- | --- |
| Saima | Integration answers and core bug fixes | Ongoing | CLI QA stalls if core questions sit unanswered |
| Jifat | Stable behavior across guided, standard, full socratic, and trail reads | Ongoing | Extension polish gets blocked on undefined behavior |
| Arif | Sample ADR + sample Trail files | Next integration cycle | Landing page embeds remain placeholder |

---

## Critical Rules

1. **Never change `packages/core/src/types.ts` without announcing it in team chat first.** If you add a new `TrailEntryType` or a new `ResponseChunk` kind, post in chat: *"Adding `ResponseChunk.kind = 'whatever'` — Saima/Jifat, check your switch statements."*
2. **Never push to `main` without `npm run check && npm run typecheck && npm run test` passing.** Broken main blocks everyone.
3. **Prompt files live in `packages/core/src/prompts/*.md`.** Iterate them in a plain Claude web UI first, paste final version into the file. Do not iterate prompts by rebuilding and testing the CLI each time — too slow.
4. **Use `docs/manual-testing.md` as the shared bug-bash script.** If someone reports a bug from a different local flow, reproduce it in the shared flow before broadening scope.
5. **Your sleep window is non-negotiable.** Garbage decisions at H30 cost more than missed features. Saima is capable; trust her.

---

## Emergency Protocols

**If LLM adapter breaks mid-build (Phase 2):** Fall back to direct Anthropic SDK calls. Keep the `LLMAdapter` interface the same; swap implementation underneath. ~45 minutes of work.

**If pi-ai turns out to be broken or unsuitable:** Same as above. Don't waste time debugging someone else's package under time pressure.

**If you fall 4+ hours behind by H12:** Cut Full Socratic mode from scope entirely. Ship Guided + Standard. Announce in team chat immediately so Jifat doesn't build UI for a mode that won't exist.

**If you fall 8+ hours behind by H24:** Execute Fallback MVP from master plan Section 6. Ship only Guided mode in both CLI and Extension. Landing page pitches the other two as "coming in v1.1."

**If a teammate is unresponsive for 2+ hours:** Check in via phone/text. If they're unavailable, redistribute their blocking work to whoever has slack. Announce in team chat.

---

*You are the technical center of gravity for this project. Move deliberately, communicate constantly, and don't be a hero. Ship the plan.*
