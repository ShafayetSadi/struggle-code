# Cross-Team Dependency Map

**One-page reference. Pin this in Discord.**

This map shows every hard dependency between team members. If you're waiting on someone or someone is waiting on you, find it here. Every dependency has a workaround noted so no one is ever truly blocked.

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

*"Core done" at H20 means Guided mode works end-to-end. Standard + Full Socratic arrive at H32/H36.*

---

## Sadi → Others

| Who needs it | What | When | If late, workaround |
| --- | --- | --- | --- |
| Saima | Real `classifyIntent()` | H6 | Stub works; CLI functional without real classification |
| Saima | Guided mode real in `sendMessage()` | H14 | Stub yields mock milestones; CLI wiring all valid |
| Saima, Jifat | Real `getTrail()` | H20 | Stub returns mock entries; UIs still render |
| Saima | Real `exportTrail()` | H20 | `/trail export` writes mock Markdown until real |
| Arif | Sample ADR (committed to demo repo) | H17 | Arif hand-crafts a placeholder Markdown, swaps later |
| Arif | Sample Learning Trail (committed to demo repo) | H22 | Same — placeholder first, real swap at H22 |
| Jifat | Standard + Full Socratic modes in core | H32/H36 | Jifat ships UI for Guided only; adds mode dropdown options that pass through |

## Saima → Others

| Who needs it | What | When | If late, workaround |
| --- | --- | --- | --- |
| Sadi | `classify.md` prompt | H6 | Sadi can't wire real classifier; uses keyword stub longer |
| Sadi | `design-interview.md` prompt | H10 | Sadi falls back to a simpler 3-question flow |
| Sadi | `guided-milestone.md` + `comprehension-check.md` | H14 | Core Guided mode delayed; Saima's CLI shows stub responses |
| Sadi | `adr-generator.md` | H17 | ADRs stay mock; landing page uses placeholder ADR |
| Sadi | `stuck-diagnostic.md` | H20 | `/stuck` command shows hardcoded 4-question flow without LLM evaluation |
| Arif | CLI in recording-ready state (polished output) | H26 | Arif records with plain asciicast; re-records after H26 |

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
2. "If Sadi is the bottleneck, everyone stalls. If Sadi stays responsive, everyone ships."
3. "Saima's prompts are the product's voice. Iterate them in Claude web UI, not in code."
4. "Jifat's extension is intentionally minimal. It proves the core ports. It does not replicate the CLI."
5. "Arif ships the story. The story is what judges remember."

Print these. Pin them. Read them when you're stuck.
