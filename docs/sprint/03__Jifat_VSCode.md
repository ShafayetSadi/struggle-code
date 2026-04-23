# Jifat — VS Code Extension Engineer

**Your role:** Sole owner of `packages/vscode/` — the VS Code extension.
**Primary package:** `packages/vscode`
**Sleep window:** H24–H32 (8 hours). Choose earlier (H16–H24) if you prefer; coordinate at kickoff.

---

## Your Prime Directive

You own the VS Code extension. No one else touches it. You consume `@socrates-ai/core` as a library and wrap it in a VS Code webview + sidebar + command experience.

**Scope discipline is critical for you.** The extension is intentionally minimal. It demonstrates that the core ports cleanly to a second shell — it does NOT need to be a full replica of the CLI. You ship:
- Chat panel webview with one working mode (Guided)
- Sidebar view for Learning Trail + ADRs
- Mode toggle UI
- One or two helper buttons (`/stuck` button)

You do NOT ship:
- All three modes with polished UI per mode
- All slash commands as buttons
- Rich code editor integration
- Diff views, inline suggestions, or anything that touches the user's actual code files

If you try to build everything the CLI has, you will finish nothing.

---

## Context You Must Read First

Spend the first 45 minutes reading:
- `05_MasterImplementationPlan_v2.md` — Parts I (Scope), V.5.3 (your specific timeline)
- `packages/core/src/types.ts` — every type you'll consume
- `packages/core/src/index.ts` — the functions you'll call
- The existing scaffold's `packages/vscode/src/extension.ts` — your starting point
- VS Code's Webview API: https://code.visualstudio.com/api/extension-guides/webview
- VS Code's Tree View API: https://code.visualstudio.com/api/extension-guides/tree-view

If you've never built a VS Code extension before, also read:
- https://code.visualstudio.com/api/get-started/your-first-extension

---

## Architectural Overview

Your extension has three runtime components:

1. **Extension Host** — `packages/vscode/src/extension.ts`. Node.js-ish context. Imports `@socrates-ai/core`. Creates sessions, manages lifecycle. Communicates with the webview via `postMessage`.

2. **Webview** — HTML/CSS/JS running in a sandboxed iframe. Displays the chat UI. Sends user messages to the extension host via `vscode.postMessage()`. Receives streaming responses via `window.addEventListener('message', ...)`.

3. **Sidebar (Tree View)** — A `TreeDataProvider` in the extension host that displays Trail entries and ADRs in the Activity Bar sidebar.

The extension host is where the real work happens. The webview is just a thin display layer. Keep it simple.

---

## Hour-by-Hour Task List

### Phase 1 — Kickoff & Foundation (H0–H4)

| Hour | Task | Dependency |
| --- | --- | --- |
| 0:00–0:30 | Kickoff call | Sadi |
| 0:30–1:00 | Verify scaffold. Open `packages/vscode/` in VS Code, press F5, confirm the extension dev host launches and the hello-world command works. | Scaffold done |
| 1:00–2:00 | Read the files listed above. Sketch the webview UI on paper or in Figma — chat bubbles, input field, mode dropdown, send button. | None |
| 2:00–4:00 | Build the webview HTML structure. Pure HTML + CSS (no React yet). Two-column layout: chat on top, input at bottom. Message passing wired (send button posts to extension host; mock "echo" response comes back). | Scaffold done |

**Checkpoint at H4:** Webview renders with a styled chat UI. User can type, press send, see an echo bubble. No real LLM integration yet.

### Phase 2 — Wire Up Core (H4–H12)

| Hour | Task | Dependency |
| --- | --- | --- |
| 4–6 | Import `@socrates-ai/core` in `extension.ts`. Implement the `IO` interface for VS Code (`ioImpl.ts` — use `vscode.workspace.fs` for file I/O, `vscode.window.show*Message` for notifications, and `webview.postMessage` for streaming). | Scaffold has stub; core stubs return mock data |
| 6–8 | On the "Start Session" command, call `core.startSession(workspacePath, vscodeIO)` and store the session. Wire the webview's send button to call `session.sendMessage(userText)` and stream chunks back to the webview. | Core stub; uses mock responses |
| 8–10 | Render each `ResponseChunk` kind in the webview: `text` as chat bubbles (streaming), `code` with syntax highlighting (use highlight.js CDN or Prism), `question` as a highlighted "awaiting answer" message, `adr` as a collapsible card, `checkpoint` as a divider. | None |
| 10–12 | Mode toggle: a dropdown at the top of the webview. Changing it calls `session.setMode(newMode)`. Display current mode in the header. | None |

**Checkpoint at H12:** You can click "Start Session," type a message, see a streamed mock response with a realistic design interview, and switch modes. Everything looks like a real product. Still running on stubs but feels real.

### Phase 3 — Trail Sidebar + Polish (H12–H20)

| Hour | Task | Dependency |
| --- | --- | --- |
| 12–15 | Create a `TreeDataProvider` for the "Learning Trail" sidebar view. Reads from `session.getTrail()` and renders entries as tree items. Update the view when new entries arrive (use a refresh event emitter). | None |
| 15–17 | Add ADRs to the sidebar. Either a second tree view or an expandable section. Clicking an ADR opens a new editor tab with its Markdown content. | Sadi's real ADRs land H14–H17; until then, stubs work |
| 17–20 | Auto file-share: when the user types `@filename` in the chat, or when an editor tab is active, offer to share that file with the AI. Call `session.shareFile(activeEditor.document.uri.fsPath)`. | None |

**Checkpoint at H20:** Sidebar shows real-looking Trail entries and ADRs as the user works. Can click an ADR to view it. Feels polished.

### Phase 4 — Critical Path to Done (H20–H24)

| Hour | Task | Dependency |
| --- | --- | --- |
| 20–22 | `/stuck` button in the chat header. Opens a modal (webview dialog) with the 4 diagnostic questions, one at a time. Feeds answers to `session.invokeStuck()`. | None |
| 22–24 | VSIX packaging. Run `vsce package` and produce a `.vsix` file. Test install on a fresh VS Code by running `code --install-extension socrates-ai-vscode-0.1.0.vsix`. Fix any packaging errors. | None |

**Checkpoint at H24:** Extension is packaged and installable. Main demo flow works end-to-end on a fresh install. Feature freeze for you starts here. Go sleep.

### Phase 5 — Sleep (H24–H32)

Phone on for emergencies only.

### Phase 6 — Integration & Polish (H32–H40)

| Hour | Task |
| --- | --- |
| 32–34 | Full-team walkthrough. Capture every UX glitch in the extension into a bug list. |
| 34–38 | Extension bug bash. Fix styling issues, streaming glitches, mode switching edge cases. If Sadi's Full Socratic or Standard modes are working by this point, add minimal UI support (at least the mode dropdown should include all three options and pass the value through). |
| 38–40 | Final VSIX build. README with install instructions. Optionally: publish to open-vsx.org if time permits (low priority, not required). |

### Phase 7 — Demo Support (H40–H48)

| Hour | Task |
| --- | --- |
| 40–43 | Record screen captures of the extension for Arif's demo video. Multiple clips: opening the panel, starting a session, streaming response, sidebar updating with ADRs. |
| 43–46 | Help with video editing if needed (Arif owns video; you support). |
| 46–48 | Final QA on VSIX, submission support. |

---

## Your Blocking Dependencies

| I am blocked by | On what | Until when | Workaround |
| --- | --- | --- | --- |
| Sadi | Nothing for core functionality — stubs are realistic enough to build the full UI | — | Build against stubs from H4 onward |
| Sadi | Real sessions for polished demo recording | H14 (Guided mode working) | Your own demo video footage should be recorded AFTER real core is ready |

**Key insight:** The scaffold's stubs let you build 100% of your UI without waiting. You only need real core for the final demo recording.

## Who Is Blocked By You

| Blocked | What they need | By when | Risk if late |
| --- | --- | --- | --- |
| Arif | Extension screen recordings | H40 | Video editing compressed; medium risk |
| Arif | Live-installable VSIX link | H40 | Landing page "Install Extension" button is disabled; medium risk |
| Sadi | Integration feedback on core edges | H12 onward | Without your feedback, core bugs in VS Code context don't surface until too late |

---

## Critical Rules

1. **Never import `fs`, `fs/promises`, `path`, or any Node module directly in the extension.** Use `vscode.workspace.fs` and `vscode.Uri` for all filesystem work. This keeps the extension working on remote workspaces.
2. **Message passing is asynchronous.** Webview → extension host messages can be lost if the webview reloads. Re-hydrate state from the extension host on webview reload (handle `onDidReceiveMessage` and be defensive).
3. **Webview CSP is strict.** You cannot inline scripts without a nonce. Use VS Code's recommended CSP pattern from the docs.
4. **Keep the webview simple.** No React, no build pipeline for the webview. Plain HTML + CSS + vanilla JS. Faster to build, faster to debug.
5. **Scope discipline.** If it's 2 AM and you're about to start building "a beautiful Prism-powered code editor inside the chat" — STOP. Ship what works.

---

## VS Code API Cheat Sheet

```typescript
// Reading files (works on remote + local)
const data = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
const text = new TextDecoder().decode(data);

// Writing files
await vscode.workspace.fs.writeFile(
  vscode.Uri.file(path),
  new TextEncoder().encode(content)
);

// Showing notifications
vscode.window.showInformationMessage("Session started");
vscode.window.showErrorMessage("Missing API key");

// Getting workspace root
const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

// Creating a webview panel
const panel = vscode.window.createWebviewPanel(
  "socratesAI",
  "Socrates AI",
  vscode.ViewColumn.One,
  { enableScripts: true, retainContextWhenHidden: true }
);

// Posting to webview
panel.webview.postMessage({ type: "chunk", payload: chunk });

// Receiving from webview
panel.webview.onDidReceiveMessage(async (msg) => { ... });

// Tree view provider
class TrailProvider implements vscode.TreeDataProvider<TrailItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<...>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  refresh() { this._onDidChangeTreeData.fire(undefined); }
  getTreeItem(el) { return el; }
  getChildren() { return session?.getTrail().map(entryToItem) ?? []; }
}
vscode.window.registerTreeDataProvider("socrates.trailView", new TrailProvider());
```

---

## Emergency Protocols

**If webview message passing is mysteriously broken:** Add `console.log` on both sides. Check `webview.options` includes `enableScripts: true`. Confirm CSP allows the script execution.

**If the sidebar tree view doesn't refresh:** You probably forgot to fire the `_onDidChangeTreeData` event. This is the #1 gotcha in TreeDataProvider work.

**If VSIX won't package:** Check that all files in `files` array in `package.json` actually exist post-build. Most packaging failures are missing `dist/` outputs.

**If you fall 4+ hours behind by H16:** Cut auto file-share and the `/stuck` button. Ship chat panel + sidebar only. The extension's job is to prove the core ports — two working features is enough to do that.

**If you fall 6+ hours behind by H20:** Ship chat panel only. Skip sidebar entirely. The minimum viable extension is "the CLI's conversation, but in a webview."

**If `@socrates-ai/core` doesn't install in the extension context:** This is an ESM/CJS interop issue. Solution: use esbuild to bundle core into the extension output. Add `"external": ["vscode"]` to esbuild config so only `vscode` is treated as a peer.

---

*You are the proof that Socrates AI is more than a one-shell toy. Ship a minimal, working extension and the team's entire architectural story gets 10x stronger.*
