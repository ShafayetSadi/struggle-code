# Arif — Landing Page + Demo Video Owner

**Your role:** Sole owner of landing page + demo video + submission form copy.
**Primary package:** `apps/landing`
**Sleep window:** H16–H24 (8 hours). Early window — you need to be fresh for the H40–H48 video sprint.

---

## Your Prime Directive

The landing page is the first thing judges see. The demo video is what they remember. Both are owned by you. Your job is to make Socrates AI feel like a real, intentional product — not a hackathon experiment.

You do not write backend code. You do not touch `packages/core`, `packages/cli`, or `packages/vscode`. If you have a strong opinion about how a CLI command should feel or what an ADR should contain, bring it to the team — but build your part of the product.

**Your three deliverables:**
1. **Landing page** at a public Vercel URL — the `hosted_project_url` for submission
2. **Demo video** (≤2:00) on YouTube — the `demo_video_url` for submission
3. **Submission note** (`anything_else_to_say`) — 3 crisp sentences

---

## Context You Must Read First

Spend the first 30 minutes after kickoff reading:
- `05_MasterImplementationPlan_v2.md` — Parts I (Product Vision), V.5.4 (your specific timeline)
- The existing scaffold's `apps/landing/app/page.tsx` — your starting point
- The conversation history in the team chat about the product's thesis ("vibe-coders ship code, engineers ship understanding")

---

## The Landing Page — What It Needs

### Structure (One Scrollable Page)

**1. Hero (above the fold)** — 100% of judges see this.
- Product name: **Socrates AI**
- Tagline: something strong and opinionated. Options:
  - "The AI pair programmer that makes you think first."
  - "Stop shipping code you can't explain."
  - "Vibe-coders ship code. Engineers ship understanding."
- Install command in a copy-able code block: `npm install -g @socrates-ai/cli`
- Secondary: "Install VS Code Extension" button linking to the VSIX download or marketplace (if published)
- "Watch 2-min demo" button → scrolls to video embed
- Optional: an autoplay-loop asciinema clip showing 10 seconds of the CLI in action (small, in the corner — evidence it's real)

**2. The Manifesto (one section, one minute of reading time)**
- Opening line: something provocative. "Every AI coding tool optimizes for one thing: removing friction. We think that's the mistake."
- One paragraph on the problem (vibe-coding, cognitive offloading)
- One paragraph citing the Kosmyna MIT study + Barcaui RCT by name and by number (MIT Media Lab 2025 EEG study found the lowest neural connectivity in LLM users; Barcaui's 2025 RCT showed 57.5% vs 68.5% on delayed retention tests)
- Close with the stance: *"Socrates AI is the opposite bet. Scaled friction. Comprehension-first. Real artifacts."*

**3. How It Works (three beats, visual)**
- **Beat 1 — Three Friction Modes.** Full Socratic (high friction, deep learning), Guided (balanced, default), Standard (low friction, but always with a digest step). Visual: three cards side by side, with distinct colors and short descriptions.
- **Beat 2 — The Socratic Gate.** The AI refuses to generate until you articulate trade-offs. Visual: a conversation snippet showing "Before we write code — what are 3 things that can go wrong with JWT auth?" → user answers → code unlocks.
- **Beat 3 — Real Artifacts.** Every milestone produces an ADR + "Concepts You Should Know" + "What Could Break" + verified doc links. Visual: a rendered ADR preview (use a real one from Sadi's sample at H22).

**4. The Learning Trail (the money section)**
- Header: *"This is what your repo looks like after learning with Socrates AI."*
- Embed a full sample Learning Trail as rendered Markdown on the page (get from Sadi at H22 — a sample from a real FastAPI blog session)
- Caption: *"Commit it. Show it to your professor. Show it to your hiring manager. This is what learning looks like."*
- This section is the single strongest asset on the page. No other hackathon team will show something like this.

**5. Built For You (target personas, brief)**
- Three cards: "The Vibe-Coder" / "The Self-Taught Dev" / "The Educator"
- One sentence each about the pain Socrates AI solves for them

**6. Get Started**
- Full install instructions (CLI + Extension)
- Link to GitHub repo
- Link to docs (repo README if no separate docs site)
- "Requires an Anthropic, Google, or OpenAI API key" note
- Link to where to get one

**7. Team + Footer**
- Built at Noverse FRICTION Hackathon 2026
- Team members credited
- Link to hackathon

### Design Language

- **Dark mode only.** The target user lives in dark terminals and dark editors.
- **Monospace accents.** Use a sharp monospace font (JetBrains Mono, IBM Plex Mono, or Geist Mono) for code blocks, install commands, and the product name in the hero.
- **Color palette:** A single accent color (suggest: warm orange like `#f97316` or deep green like `#10b981`) against dark gray/black backgrounds. Don't use more than 2 colors.
- **No stock imagery.** No developer-at-laptop photos. No generic gradients. The visual language is typography + asciinema recordings + rendered Markdown.
- **No emoji in the UI.** Keep it serious. The product is making a serious claim.

### Technical Stack (Already in the Scaffold)

- Next.js 15 App Router
- TypeScript
- Tailwind CSS 4
- shadcn/ui primitives (Card, Button, etc.)
- `asciinema-player` npm package for embedding CLI recordings
- `react-markdown` + `shiki` for rendering the sample Learning Trail inline
- Deploy target: Vercel (already configured)

### Inspiration to Calibrate Against

Before you start writing, open these tabs and spend 15 minutes looking at each:
- cursor.com (old version)
- warp.dev
- zed.dev
- claude.com (Anthropic's current site)
- stripe.com/docs

These are the reference standard for developer-tool marketing. Your goal isn't to copy — it's to calibrate what "this looks intentional" feels like.

---

## The Demo Video — What It Needs

### Structure (2:00 Max)

**0:00–0:15 — Cold Open (no narration, music only)**
- Split screen
- Left: User types "Help me build a blogging website with FastAPI" into Cursor/Claude Code
- Cursor spits out 400 lines across 8 files in 15 seconds
- Cut to the user's face (a real reaction shot, or a blank stare — both work)
- Overlay text: *"You built it. Can you debug it?"*

**0:15–0:45 — The Stance**
- Narration begins: *"We've spent a decade making AI coding frictionless. And we've forgotten how to code."*
- On screen: the Kosmyna MIT Media Lab finding (lowest neural connectivity)
- On screen: Barcaui's 57.5% vs 68.5% retention gap
- Narration: *"Socrates AI is the opposite bet. Scaled friction. Real comprehension. Ship code you can defend."*

**0:45–1:15 — The Product (Guided Mode Walkthrough)**
- Fast-forwarded design interview for the FastAPI blog (6 minutes compressed to 20 seconds with captions)
- Show the design doc dropping into the user's project
- Show milestone 1 generating, user running it, answering the comprehension check
- Transition to Build mode (or the equivalent — coordinate with Sadi)
- Show the user filling in a function body with a `/hint` invocation
- Show the ADR dropping into the sidebar

**1:15–1:40 — The Artifact**
- Cut to the user's GitHub repo
- Click into `LEARNING_TRAIL.md`
- Scroll through it slowly — the judge sees a real document emerge
- Narration: *"This is what your repo looks like after learning with Socrates AI. Commit it. Submit it to your professor. Show it in your next interview."*

**1:40–1:55 — Two Shells, One Core**
- Cut to the VS Code extension running the same flow
- Narration: *"CLI for the terminal. VS Code for the editor. Same core. Same stance."*
- Show the extension's sidebar populated with ADRs and Trail entries

**1:55–2:00 — Closing Title**
- Full screen: **"Vibe-coders ship code. Engineers ship understanding. Choose."**
- Logo + URL

### Production Specs

- **Format:** 1920x1080, 30fps, H.264
- **Audio:** Clean narration (use a cardioid mic or Sadi/Saima's voice if yours isn't strong). No background music competing with narration. Optional subtle music underneath at -20dB.
- **Captions:** Burn in captions for every line of narration. Judges often watch muted.
- **Pacing:** Nothing stays on screen for more than 4 seconds except the closing card.

### Tools

- **Screen recording:** OBS Studio (free, cross-platform) or Descript
- **asciinema:** Record CLI sessions separately, embed via HTML converter or re-record as video
- **Editor:** DaVinci Resolve (free), CapCut (free, fast), or Shotcut
- **Narration recording:** Audacity. Record in a quiet room. Re-record any line that sounds like you're reading.

---

## Hour-by-Hour Task List

### Phase 1 — Kickoff & Setup (H0–H4)

| Hour | Task | Dependency |
| --- | --- | --- |
| 0:00–0:30 | Kickoff call | Sadi |
| 0:30–1:00 | Verify `apps/landing` runs: `npm run dev --workspace landing`, Next.js serves at localhost:3000 | Scaffold done |
| 1:00–2:00 | Deploy the empty scaffold to Vercel right now. Get the public URL reserved. Post it in team chat. | Vercel account |
| 2:00–4:00 | Hero section: logo/wordmark, tagline (decide with team), install command block with copy button, "Watch demo" button (disabled for now). Get the above-the-fold section 80% done. | None |

**Checkpoint at H4:** Landing page URL is live with a real-looking hero.

### Phase 2 — Content Build (H4–H16)

| Hour | Task | Dependency |
| --- | --- | --- |
| 4–7 | Manifesto section. Write the copy. Iterate twice. Get factual claims right (Kosmyna study, Barcaui RCT). | None |
| 7–10 | "How It Works" three-beats section. Design the three friction mode cards (Tailwind + shadcn Card). Write short, punchy copy for each. | None |
| 10–13 | "Built For You" personas section. Three cards, brief copy. | None |
| 13–16 | "Get Started" section + footer + team credits. Responsive mobile pass. Fix anything ugly. | None |

**Checkpoint at H16:** Landing page is visually 85% done. Missing: asciinema clips, sample Learning Trail, demo video.

### Phase 3 — Sleep (H16–H24)

Hard sleep. Phone on for team emergencies only.

This early window is strategic: you need to be maximally fresh for the H40–H48 video sprint, which is the highest-stakes work in the whole hackathon.

### Phase 4 — Integrate Real Assets (H24–H36)

| Hour | Task | Dependency |
| --- | --- | --- |
| 24–26 | Get the sample Learning Trail from Sadi (he posted it at H22). Render it inline on the landing page using `react-markdown` + `shiki`. Make sure code blocks render with syntax highlighting. | Sadi's sample Trail at H22 |
| 26–29 | Record first asciinema clips with Saima (she's running the CLI; you're capturing). Short clips: Guided mode opening, one milestone, one stuck session. | Saima available; CLI working (H20+) |
| 29–32 | Embed asciinema clips in the landing page. Use the `asciinema-player` npm package. Test playback on mobile. | Clips recorded |
| 32–34 | Demo video script draft. Write the full narration line by line, timed. Get review from Sadi for technical accuracy. | None |
| 34–36 | Storyboard the video: which screen captures you need, in what order, with what overlays. | Script approved |

### Phase 5 — Video Production (H36–H47)

| Hour | Task | Dependency |
| --- | --- | --- |
| 36–40 | Record video screen captures. Left-side (Cursor/standard AI) reactions + right-side (Socrates AI) walkthroughs. Multiple takes. Record narration separately. | Sadi + Saima for demos; Jifat for extension captures |
| 40–44 | Edit the video. Sync narration to screens. Add captions, overlays for citations, title card, closing card. | Footage ready |
| 44–46 | Review cut with the team. Factual accuracy check with Sadi. Final tweaks. | Team available |
| 46–47 | Export, upload to YouTube (unlisted first, public at submission). Update the landing page "Watch demo" button to link to the YouTube embed. | Video final |

### Phase 6 — Submission (H47–H48)

| Hour | Task | Dependency |
| --- | --- | --- |
| 47–47:30 | Write the `anything_else_to_say` submission note with Sadi. 3 sentences. Not more. | Sadi |
| 47:30–48 | Final landing page polish. Submit the hackathon form. Screenshot confirmation. | All URLs working |

---

## Your Blocking Dependencies

| I am blocked by | On what | Until when | Workaround |
| --- | --- | --- | --- |
| Sadi | Sample Learning Trail | H22 | Use a hand-crafted placeholder Markdown (you write one that looks reasonable); swap with real when available |
| Sadi | Sample ADR | H17 | Same — use a placeholder; swap later |
| Saima | CLI recording-ready state | H26 | Use plain asciicast of the stub version for H24–H26 work; re-record after H26 |
| Jifat | Extension screen recordings | H40 | Video section "Two Shells" is delayed; script is otherwise intact |

## Who Is Blocked By You

| Blocked | What they need | By when | Risk if late |
| --- | --- | --- | --- |
| Team | Public landing URL | H4 | None if you hit it; submission-critical if you don't |
| Team | Demo video on YouTube | H47 | Submission-critical |

---

## Critical Rules

1. **Deploy the empty landing page to Vercel in the first 2 hours.** Get the URL reserved. Ugly is fine; missing is catastrophic.
2. **Factual accuracy matters.** Every claim in the manifesto (citations, statistics) gets checked by Sadi before the video goes up. If you cite Kosmyna or Barcaui, get the numbers exactly right.
3. **Pacing in the video is everything.** If a beat lands flat, cut it. 90 seconds of great content beats 120 seconds of padded content.
4. **Test the landing page in incognito mode.** Before submission, open the URL in a fresh browser with no extensions. If it doesn't load or looks broken, fix it.
5. **Your sleep window is non-negotiable.** The video sprint from H36 onward is the most stressful work in the hackathon. You must be fresh for it.
6. **Do not touch backend code.** You can file issues. You can suggest changes. You cannot fix them yourself. This discipline protects everyone's time.

---

## Copy Samples to Get You Started

### Hero tagline options (pick one with team at kickoff):
- "The AI pair programmer that makes you think first."
- "Stop shipping code you can't explain."
- "Vibe-coders ship code. Engineers ship understanding."
- "AI coding, but you actually learn."

### Manifesto opener options:
- "Every AI coding tool optimizes for one thing: removing friction. We think that's the mistake."
- "We've spent a decade making AI coding frictionless. And we've forgotten how to code."
- "Cursor, Copilot, Bolt — they all optimize for speed. We optimize for something harder: comprehension."

### Closing-line options (for video and landing page footer):
- "Vibe-coders ship code. Engineers ship understanding. Choose."
- "The best code is the code you understand."
- "Understanding is not a productivity loss. It's the point."

---

## The Submission Note Draft (refine at H47)

Target: 3 sentences. Example:

> *Socrates AI is our stance: vibe-coders ship code, engineers ship understanding. We built it as both a CLI and a VS Code extension on a shared core, proving that scaled friction can port across surfaces without rewriting logic. The three friction modes and generated ADRs make comprehension a first-class engineering artifact — a document you commit alongside your code.*

---

## Emergency Protocols

**If Vercel deploy is broken:** Fall back to a single HTML file on GitHub Pages. Ugly is fine; having a live URL is required.

**If video production runs past H46:** Submit the raw asciinema walkthrough + a longer written submission note explaining what the video would have shown. The landing page still needs to be strong.

**If the team's product is broken by H44:** The video shows what it would do. Be honest in narration ("our MVP demonstrates the architecture; some features are roadmap"). Pivot the close to *"the stance stands even if we didn't finish all three modes"*.

**If you fall 4+ hours behind by H32:** Cut the "Built For You" personas section. Cut asciinema embeds (use static screenshots). Focus on hero + manifesto + how-it-works + learning trail + video.

---

*You're the face of the product. Judges form 40% of their opinion in the first 30 seconds of the landing page, and the other 60% during the video. Everything else the team built lives or dies by what you ship.*
