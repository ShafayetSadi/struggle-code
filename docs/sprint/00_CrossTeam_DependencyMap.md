# Cross-Team Dependency Map

**One-page reference. Pin this in Discord.**

This map shows every hard dependency between team members. If you're waiting on someone or someone is waiting on you, find it here. Every dependency has a workaround noted so no one is ever truly blocked.

## Current Status Snapshot

As of the latest local integration pass:

- `packages/core` guided flow, standard mode, socratic mode, ADR generation, and trail export are implemented
- `packages/cli` REPL is implemented with `/help`, `/mode`, `/share`, `/stuck`, `/hint`, `/trail export`, and `/exit`
- prompt files in `packages/core/src/prompts/*.md` exist for classifier, quick help, debug, guided, standard, socratic, ADRs, stuck flow, and hints
- shared manual QA now lives in `docs/manual-testing.md`
- the known recent fix is the guided interview guard: short meta-input like `what is this bug` should no longer be swallowed as a design answer
- remaining work is integration QA, bug bash, demo polish, sample artifacts, and publish/submission prep

---

## Quick Reference: Who Owns What

| Person | Package | Primary responsibility |
| --- | --- | --- |
| **Sadi** | `packages/core` | All core logic; team leadership; defends scope |
| **Saima** | `packages/cli` + prompt files | CLI REPL; prompt engineering (content) |
| **Jifat** | `packages/vscode` | VS Code extension (webview + sidebar) |
| **Arif** | `apps/landing` | Landing page; demo video; submission copy |

---

## The Dependency Timeline

```
H0────H4────H8────H12───H16───H20───H24───H28───H32───H36───H40───H44───H48
│     │     │     │     │     │     │     │     │     │     │     │     │
Kick- │     │     │Guid- │     Trail│     │     │     Integ-│Video│Submit
off   │     │     │ ed   │     │    │     │     │     ration│sprint│
      │Foun-│Clas-│mode  │     │    │     │     │     │     │     │
      │dation│ifier│ready │Core │    │     │     │     │     │     │
      │     │ready│      │done*│    │     │     │     │     │     │
                          (gu-                                         
                          ided)                                       
```

*“Core done” at H20 means Guided mode works end-to-end. Standard + Socratic arrive at H32/H36.*

---

## Sadi → Others

| Who needs it | What | When | If late, workaround |
| --- | --- | --- | --- |
| Saima | Real `classifyIntent()` | Done locally | No workaround needed now |
| Saima | Guided mode real in `sendMessage()` | Done locally | No workaround needed now |
| Saima, Jifat | Real `getTrail()` | Done locally | No workaround needed now |
| Saima | Real `exportTrail()` | Done locally | No workaround needed now |
| Arif | Sample ADR (committed to demo repo) | H17 | Arif hand-crafts a placeholder Markdown, swaps later |
| Arif | Sample Learning Trail (committed to demo repo) | H22 | Same — placeholder first, real swap at H22 |
| Jifat | Standard + Socratic modes in core | Done locally | Jifat should smoke-test pass-through and rendering now |

## Saima → Others

| Who needs it | What | When | If late, workaround |
| --- | --- | --- | --- |
| Sadi | `classify.md` prompt | Done locally | No workaround needed now |
| Sadi | `design-interview.md` prompt | Done locally | No workaround needed now |
| Sadi | `guided-milestone.md` + `comprehension-check.md` | Done locally | No workaround needed now |
| Sadi | `adr-generator.md` | Done locally | No workaround needed now |
| Sadi | `stuck-diagnostic.md` + hint prompts | Done locally | No workaround needed now |
| Arif | CLI in recording-ready state (polished output) | In progress | Use `docs/manual-testing.md` to find recording blockers quickly |

## Jifat → Others

| Who needs it | What | When | If late, workaround |
| --- | --- | --- | --- |
| Arif | Extension screen recordings | H40 | Video's "Two Shells" section delayed; script adjusted to CLI-focus |
| Arif | Live-installable VSIX link | H40 | Landing page's "Install Extension" button shows "coming soon" |
| Sadi | Feedback on core's behavior in VS Code context | H12 onward (continuous) | Bugs in VS Code context surface late; higher risk of submission-day issues |

## Arif → Others

| Who needs it | What | When | If late, workaround |
| --- | --- | --- | --- |
| Team | Public landing URL deployed | H4 | Submission blocker if not done by H48; deploy ugly first, polish later |
| Team | Demo video public on YouTube | H47 | Submission blocker |

---

## The Daily Sync Protocol

**3-minute voice sync at H6, H12, H18, H24, H30, H36, H42.**

Each person answers 3 questions in ~30 seconds:
1. What did I finish since the last sync?
2. What am I working on now?
3. Am I blocked on anyone, and by when do I need them?

If anyone flags a blocker: the blocker-owner speaks up immediately with "I'll have it in X hours" or "here's the workaround for now."

No meetings longer than 3 minutes unless there's a decision to make. Typing in chat is almost always better than a meeting.

---

## Sleep Rotation

| Developer | Sleep window |
| --- | --- |
| Arif | H16–H24 (before video sprint) |
| Sadi | H20–H28 (mid-build, after core milestones) |
| Jifat | H24–H32 (after extension MVP lands) |
| Saima | H28–H36 (covering Sadi's post-sleep gap first) |

At any given hour, **minimum 3 people awake**. No exceptions unless a genuine emergency.

---

## Emergency Channels

- **Non-blocking questions:** Discord text channel `#socrates-build`
- **Blockers (someone is stuck):** Tag the specific person with `@` in `#blockers`
- **Outages (power, internet):** Direct message the person and switch to mobile hotspot if needed
- **Emergency decisions (mid-build pivots):** Voice call, 2 minutes max, decision logged in `#decisions`

---

## The Five Sentences That Decide This Hackathon

1. "The scaffold's stubs are realistic enough to build against — no one is waiting."
2. "If Sadi is the bottleneck, everyone stalls. Right now the bottleneck is integration quality, not missing scaffolding."
3. "Saima's prompts are the product's voice. Iterate them in Claude web UI, then validate them with `docs/manual-testing.md`."
4. "Jifat's extension is intentionally minimal. It proves the core ports. It does not replicate the CLI."
5. "Arif ships the story. The story is what judges remember."

Print these. Pin them. Read them when you're stuck.
