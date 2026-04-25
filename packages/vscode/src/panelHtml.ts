function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function getPanelHtml(): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Struggle AI</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0e150e;
        --topbar: #09090b;
        --surface: #1a221a;
        --surface-low: #161d16;
        --surface-high: #242c24;
        --surface-highest: #2f372e;
        --border: #3d4a3d;
        --text: #dce5d9;
        --muted: #bccbb9;
        --muted-2: #869585;
        --accent: #4be277;
        --accent-strong: #22c55e;
        --error: #ffb4ab;
        --error-weak: rgba(255, 180, 171, 0.12);
        --shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
        font-family: Inter, "Segoe UI", ui-sans-serif, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        height: 100%;
        background: var(--bg);
        color: var(--text);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 48px;
        padding: 0 16px;
        border-bottom: 1px solid #27272a;
        background: var(--topbar);
        flex-shrink: 0;
      }
      .logo {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mode-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 10px;
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 20px;
        position: relative;
      }
      .mode-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--accent-strong);
      }
      .mode-select {
        appearance: none;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--text);
        font: 600 11px/16px Inter, sans-serif;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        cursor: pointer;
      }
      .mode-select-hidden {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 1px;
        height: 1px;
      }
      .mode-button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 0;
        background: transparent;
        color: var(--text);
        font: 600 11px/16px Inter, sans-serif;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        cursor: pointer;
        padding: 2px 0;
      }
      .mode-button svg { color: #9ca3af; }
      .mode-menu {
        position: absolute;
        right: 0;
        top: calc(100% + 6px);
        display: none;
        min-width: 180px;
        border: 1px solid var(--border);
        border-radius: 10px;
        background: #101710;
        box-shadow: var(--shadow);
        overflow: hidden;
        z-index: 70;
      }
      .mode-menu.open { display: block; }
      .mode-option {
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--muted);
        text-align: left;
        font: 600 11px/16px Inter, sans-serif;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 10px 12px;
        cursor: pointer;
      }
      .mode-option:hover {
        background: rgba(75, 226, 119, 0.08);
        color: var(--text);
      }
      .mode-option.active {
        background: rgba(75, 226, 119, 0.14);
        color: var(--accent);
      }
      .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: 0;
        background: transparent;
        color: #71717a;
        cursor: pointer;
        border-radius: 6px;
        transition: color .15s, background .15s;
      }
      .icon-btn:hover { color: var(--text); background: #18181b; }
      .stage {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        position: relative;
      }
      .welcome {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 180px);
        padding: 24px;
        text-align: center;
        position: relative;
      }
      .welcome::before {
        content: "";
        position: absolute;
        width: 500px;
        height: 500px;
        border-radius: 50%;
        background: rgba(75, 226, 119, 0.10);
        filter: blur(120px);
        pointer-events: none;
      }
      .welcome-content {
        position: relative;
        z-index: 2;
        max-width: 640px;
      }
      .robot-icon {
        width: 80px;
        height: 80px;
        object-fit: contain;
        filter: drop-shadow(0 0 12px rgba(75, 226, 119, 0.2));
        margin-bottom: 24px;
      }
      .welcome-title {
        font-size: 24px;
        line-height: 32px;
        font-weight: 600;
        letter-spacing: -0.02em;
        margin-bottom: 4px;
      }
      .welcome-sub {
        font-size: 14px;
        line-height: 20px;
        color: var(--muted);
        opacity: .8;
      }
      .welcome-sub .cmd {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 6px;
        background: rgba(75, 226, 119, 0.10);
        color: var(--accent-strong);
        font-family: ui-monospace, monospace;
        font-size: 12px;
      }
      .suggestion-cards {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 40px;
      }
      .suggestion-card {
        text-align: left;
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface-low);
        cursor: pointer;
        color: var(--text);
        transition: border-color .16s, background .16s;
      }
      .suggestion-card:hover { border-color: rgba(75, 226, 119, .5); }
      .card-icon { display: block; color: var(--accent-strong); margin-bottom: 8px; font-size: 16px; }
      .card-title { font-size: 11px; line-height: 16px; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
      .card-sub { font-size: 13px; line-height: 18px; color: rgba(220,229,217,.65); }
      .stream {
        display: flex;
        flex-direction: column;
        gap: 18px;
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 24px 220px;
      }
      .message { display: flex; flex-direction: column; gap: 8px; }
      .message.user { align-items: flex-end; }
      .message.user .body {
        background: var(--surface-low);
        border: 1px solid var(--border);
        border-radius: 12px;
        max-width: 85%;
        padding: 12px 20px;
      }
      .message.assistant { align-items: flex-start; }
      .ai-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--accent);
        font-size: 11px;
        line-height: 16px;
        font-weight: 600;
        letter-spacing: .05em;
      }
      .ai-label::before { content: "▣"; font-size: 14px; }
      .message.assistant .body {
        background: var(--surface-high);
        border: 1px solid rgba(75, 226, 119, .2);
        border-radius: 16px;
        box-shadow: var(--shadow);
        padding: 16px 20px;
        width: min(100%, 760px);
      }
      .assistant-actions {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid rgba(134,149,133,.3);
        display: flex;
        gap: 10px;
      }
      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 8px;
        border: 1px solid;
        padding: 8px 12px;
        font: 600 11px/16px Inter, sans-serif;
        letter-spacing: .05em;
        text-transform: uppercase;
        background: transparent;
        cursor: pointer;
      }
      .action-btn.hint { color: #96d59d; border-color: rgba(150,213,157,.35); background: rgba(23,84,40,.20); }
      .action-btn.stuck { color: var(--error); border-color: rgba(255,180,171,.25); background: var(--error-weak); }
      .code-block {
        margin-top: 16px;
        border-radius: 12px;
        border: 1px solid #27272a;
        background: #09090b;
        overflow: hidden;
      }
      .code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid #27272a;
        font-family: ui-monospace, monospace;
        font-size: 12px;
        color: #a1a1aa;
      }
      .code-body {
        padding: 14px;
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 13px;
        line-height: 20px;
        white-space: pre;
      }
      .message.system .body, .message.error .body {
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 13px;
        max-width: 760px;
      }
      .message.system .body { background: #101910; border: 1px solid #1f2f1f; color: #b2f2b7; }
      .message.error .body { background: #1b1010; border: 1px solid rgba(255,180,171,.35); color: var(--error); }
      .input-shell {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: 0;
        width: min(900px, calc(100vw - 32px));
        background: transparent;
        z-index: 40;
        padding: 16px 0 10px;
      }
      .input-bar {
        background: var(--surface-high);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 8px;
        box-shadow: var(--shadow);
      }
      .input-row { display: flex; align-items: center; gap: 8px; padding: 0 6px; }
      .attach-btn {
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: var(--muted);
        border-radius: 8px;
        cursor: pointer;
      }
      .attach-btn:hover { color: var(--accent); }
      .composer-wrap { flex: 1; min-width: 0; }
      .composer-input {
        width: 100%;
        min-height: 32px;
        max-height: 120px;
        resize: none;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--text);
        font: inherit;
        padding: 6px 0;
      }
      .composer-input::placeholder { color: rgba(188,203,185,.5); }
      .send-button {
        border: 0;
        border-radius: 10px;
        background: var(--accent-strong);
        color: #003915;
        font: 600 11px/16px Inter, sans-serif;
        letter-spacing: .05em;
        text-transform: uppercase;
        padding: 7px 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
      }
      .send-button:disabled { opacity: .45; cursor: not-allowed; }
      .input-meta {
        font-size: 10px;
        color: rgba(188,203,185,.45);
        text-transform: uppercase;
        letter-spacing: .1em;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 8px 2px;
        border-top: 1px solid rgba(134,149,133,.3);
        margin-top: 6px;
      }
      .model-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface-low);
        padding: 4px 8px;
        cursor: pointer;
        color: var(--muted);
      }
      .context-badge { display: none; }
      .context-badge.visible { display: inline-block; }
      .slash-popup {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 164px;
        width: min(540px, calc(100vw - 32px));
        border-radius: 16px;
        border: 1px solid var(--border);
        background: var(--surface-highest);
        overflow: hidden;
        display: none;
        box-shadow: var(--shadow);
        z-index: 45;
      }
      .slash-popup.open { display: block; }
      .slash-popup-header {
        padding: 8px 12px;
        font-size: 10px;
        font-weight: 700;
        color: #71717a;
        letter-spacing: .12em;
        text-transform: uppercase;
        border-bottom: 1px solid var(--border);
      }
      .slash-cmd {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        cursor: pointer;
        border-left: 4px solid transparent;
      }
      .slash-cmd:hover { background: rgba(75,226,119,.06); border-left-color: var(--accent-strong); }
      .slash-cmd.active { background: rgba(75,226,119,.10); border-left-color: var(--accent-strong); }
      .slash-cmd-icon {
        width: 20px;
        text-align: center;
        color: #71717a;
      }
      .slash-cmd.active .slash-cmd-icon { color: var(--accent); }
      .slash-cmd-info { flex: 1; min-width: 0; }
      .slash-cmd-name { font-weight: 600; }
      .slash-cmd-desc { font-size: 12px; color: #9ca3af; }
      .slash-cmd-enter {
        font-size: 10px;
        padding: 2px 5px;
        border: 1px solid #3f3f46;
        border-radius: 4px;
        color: #a1a1aa;
      }
      @media (max-width: 700px) {
        .suggestion-cards { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <header class="header">
      <span class="logo">Struggle AI</span>
      <div class="header-right">
        <div class="mode-wrap">
          <span class="mode-dot" aria-hidden="true"></span>
          <button class="mode-button" id="mode-button" type="button" aria-label="Session mode">
            <span id="mode-button-label">Guided Mode</span>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 6l4 4 4-4H4z"/>
            </svg>
          </button>
          <select class="mode-select mode-select-hidden" id="mode-select" aria-label="Session mode">
            <option value="guided">Guided Mode</option>
            <option value="standard">Standard Mode</option>
            <option value="socratic">Socratic Mode</option>
          </select>
          <div class="mode-menu" id="mode-menu" role="menu" aria-label="Session modes">
            <button class="mode-option" type="button" data-mode="guided">Guided Mode</button>
            <button class="mode-option" type="button" data-mode="standard">Standard Mode</button>
            <button class="mode-option" type="button" data-mode="socratic">Socratic Mode</button>
          </div>
        </div>
        <button class="icon-btn" id="settings-btn" title="More options" aria-label="More options">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3.2a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm0 6a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4zm0 6a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4z"/>
          </svg>
        </button>
      </div>
    </header>
    <div class="stage" id="stage">
      <div class="welcome" id="welcome-state">
        <div class="welcome-content">
          <img class="robot-icon" src="https://lh3.googleusercontent.com/aida/ADBb0uicecM3T4yuJa-istWdl5qK5NXLjLTSD_Nn9mv8FsVANowLR3SUxRC0LG1u3AmbwURWz7aMASPp0V_8Bc35Cwd1UFOBfzPUqRshH8RuUae0eN3oCoxDQQqXBYAzwzM0PKcTM_LdFi2_LDAvsj2V5lhrGZGJ9B0DPuSxYfHRr3M0Q7RQLG-joku51_6BX8dSurO0hYDzSksoh40Eb612__zTJA0zYS4_HsgyDdReKjYiHl748wDaEufMGd-U6eMYvGvArNm3Yfc" alt="Struggle AI Logo" />
          <h1 class="welcome-title">Think before you build.</h1>
          <p class="welcome-sub">Ask a question or use <span class="cmd">/help</span> to get started</p>
          <div class="suggestion-cards">
            <button class="suggestion-card" id="card-arch" type="button">
              <span class="card-icon">⌘</span>
              <span class="card-title">Analyze Architecture</span>
              <span class="card-sub">Review current project structure</span>
            </button>
            <button class="suggestion-card" id="card-debug" type="button">
              <span class="card-icon">⚡</span>
              <span class="card-title">Debug Session</span>
              <span class="card-sub">Find bottlenecks in your logic</span>
            </button>
          </div>
        </div>
      </div>
      <div class="stream" id="stream" style="display:none;"></div>
      <div class="slash-popup" id="slash-popup">
        <div class="slash-popup-header">Available Commands</div>
      </div>
    </div>
    <div class="input-shell">
      <div class="input-bar">
        <div class="input-row">
          <button class="attach-btn" id="share-active-btn" aria-label="Attach file">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.5 4.2a4 4 0 0 0-5.6 0L2.3 9.8a2.8 2.8 0 1 0 4 4l4.2-4.2a.5.5 0 1 0-.7-.7L5.6 13a1.8 1.8 0 1 1-2.6-2.5l5.5-5.5a3 3 0 1 1 4.2 4.2L8 13.9a.5.5 0 0 0 .7.7l4.8-4.8a4 4 0 0 0 0-5.6Z"/>
            </svg>
          </button>
          <div class="composer-wrap">
            <textarea class="composer-input" id="input" placeholder="Ask about your code..." rows="1" aria-label="Message input"></textarea>
          </div>
          <button class="send-button" id="send-btn" type="button">
            Send
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7.5 1.5l6 5.5-6 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="input-meta">
          <button class="model-chip" id="model-btn" type="button" aria-label="change model">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.2"/>
              <circle cx="5" cy="5" r="1.5" fill="currentColor"/>
            </svg>
            <span id="model-label">Struggle-1.0</span>
          </button>
          <span class="context-badge" id="context-badge"></span>
          <span>Struggle AI can make mistakes. Verify important code.</span>
        </div>
      </div>
    </div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const stageEl      = document.getElementById("stage");
      const welcomeEl    = document.getElementById("welcome-state");
      const streamEl     = document.getElementById("stream");
      const inputEl      = document.getElementById("input");
      const sendBtnEl    = document.getElementById("send-btn");
      const modeSelectEl = document.getElementById("mode-select");
      const modeButtonEl = document.getElementById("mode-button");
      const modeButtonLabelEl = document.getElementById("mode-button-label");
      const modeMenuEl = document.getElementById("mode-menu");
      const shareActEl   = document.getElementById("share-active-btn");
      const modelBtnEl   = document.getElementById("model-btn");
      const modelLabelEl = document.getElementById("model-label");
      const contextBadge = document.getElementById("context-badge");
      const slashPopup   = document.getElementById("slash-popup");

      const SLASH_COMMANDS = [
        { cmd: "/help",  desc: "explain current content",   icon: "?",  cls: "green" },
        { cmd: "/hint",  desc: "get a small nudge",          icon: "!",  cls: "yellow" },
        { cmd: "/stuck", desc: "diagnose where you're stuck",icon: "&#215;", cls: "red" },
      ];

      // ── helpers ──────────────────────────────────────────────────────────────

      function scrollToBottom() {
        stageEl.scrollTop = stageEl.scrollHeight;
      }

      function showStream() {
        welcomeEl.style.display = "none";
        streamEl.style.display  = "flex";
      }

      function resetToWelcome() {
        streamEl.innerHTML = "";
        streamEl.style.display  = "none";
        welcomeEl.style.display = "";
      }

      function setBusy(busy) {
        sendBtnEl.disabled    = busy;
        modeSelectEl.disabled = busy;
        modeButtonEl.disabled = busy;
        shareActEl.disabled   = busy;
        modelBtnEl.disabled   = busy;
      }

      function updateHeader(payload) {
        const nextMode = payload.mode || "guided";
        modeSelectEl.value = nextMode;
        updateModeUi(nextMode);
        if (payload.providerLabel) modelLabelEl.textContent = payload.providerLabel;
        setBusy(!!payload.busy);
      }

      function modeLabel(mode) {
        return mode === "standard" ? "Standard Mode" : mode === "socratic" ? "Socratic Mode" : "Guided Mode";
      }

      function updateModeUi(mode) {
        modeButtonLabelEl.textContent = modeLabel(mode);
        modeMenuEl.querySelectorAll(".mode-option").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.mode === mode);
        });
      }

      function closeModeMenu() {
        modeMenuEl.classList.remove("open");
      }

      // ── slash popup ──────────────────────────────────────────────────────────

      function renderSlashPopup(query) {
        const matches = SLASH_COMMANDS.filter(c => c.cmd.startsWith(query));
        if (!matches.length) { slashPopup.classList.remove("open"); return; }

        slashPopup.innerHTML = '<div class="slash-popup-header">Available Commands</div>';
        matches.forEach((c, i) => {
          const row = document.createElement("div");
          row.className = "slash-cmd" + (i === 0 ? " active" : "");
          row.innerHTML =
            '<span class="slash-cmd-icon ' + c.cls + '">' + c.icon + '</span>' +
            '<div class="slash-cmd-info">' +
              '<div class="slash-cmd-name">' + c.cmd + '</div>' +
              '<div class="slash-cmd-desc">' + c.desc + '</div>' +
            '</div>' +
            (i === 0 ? '<span class="slash-cmd-enter">enter</span>' : '');
          row.addEventListener("click", () => {
            inputEl.value = c.cmd + " ";
            slashPopup.classList.remove("open");
            inputEl.focus();
          });
          slashPopup.appendChild(row);
        });
        slashPopup.classList.add("open");
      }

      function closeSlashPopup() { slashPopup.classList.remove("open"); }

      // ── message rendering ────────────────────────────────────────────────────

      function renderEntry(entry) {
        const node = document.createElement("div");
        node.className = "message " + entry.role;

        if (entry.role === "user") {
          const body = document.createElement("div");
          body.className = "body";
          body.textContent = entry.text;
          node.appendChild(body);

        } else if (entry.role === "assistant") {
          const label = document.createElement("div");
          label.className = "ai-label";
          label.textContent = "STRUGGLE AI";
          node.appendChild(label);

          const body = document.createElement("div");
          body.className = "body";
          body.textContent = entry.text;
          node.appendChild(body);

          const actions = document.createElement("div");
          actions.className = "assistant-actions";

          const hintBtn = document.createElement("button");
          hintBtn.className = "action-btn hint";
          hintBtn.textContent = "HINT";
          hintBtn.addEventListener("click", () => vscode.postMessage({ type: "hint", level: 1 }));

          const stuckBtn = document.createElement("button");
          stuckBtn.className = "action-btn stuck";
          stuckBtn.textContent = "STUCK?";
          stuckBtn.addEventListener("click", () => vscode.postMessage({ type: "stuck" }));

          actions.appendChild(hintBtn);
          actions.appendChild(stuckBtn);
          node.appendChild(actions);

        } else {
          const body = document.createElement("div");
          body.className = "body";
          body.textContent = entry.text;
          node.appendChild(body);
        }

        streamEl.appendChild(node);
        showStream();
        scrollToBottom();
      }

      function patchLastAssistant(text) {
        const last = streamEl.querySelector(".message.assistant:last-of-type .body");
        if (!last) { renderEntry({ role: "assistant", text }); return; }
        last.textContent += text;
        scrollToBottom();
      }

      // ── send ─────────────────────────────────────────────────────────────────

      function sendValue(value) {
        const trimmed = value.trim();
        if (!trimmed) return;
        vscode.postMessage({ type: "send", value: trimmed });
        inputEl.value = "";
        inputEl.style.height = "auto";
        closeSlashPopup();
        closeModeMenu();
      }

      // ── event listeners ───────────────────────────────────────────────────────

      inputEl.addEventListener("input", () => {
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
        const val = inputEl.value;
        if (val.startsWith("/") && !val.includes(" ")) {
          renderSlashPopup(val);
        } else {
          closeSlashPopup();
        }
      });

      inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendValue(inputEl.value); }
        if (e.key === "Escape") { closeSlashPopup(); closeModeMenu(); }
      });

      sendBtnEl.addEventListener("click", () => sendValue(inputEl.value));

      document.getElementById("card-arch").addEventListener("click",
        () => sendValue("Analyze the architecture of this project"));
      document.getElementById("card-debug").addEventListener("click",
        () => sendValue("Help me start a debug session"));

      modeSelectEl.addEventListener("change",
        () => vscode.postMessage({ type: "setMode", mode: modeSelectEl.value }));
      modeButtonEl.addEventListener("click", () => {
        if (modeButtonEl.disabled) return;
        modeMenuEl.classList.toggle("open");
      });
      modeMenuEl.querySelectorAll(".mode-option").forEach((btn) => {
        btn.addEventListener("click", () => {
          const nextMode = btn.dataset.mode;
          if (!nextMode) return;
          modeSelectEl.value = nextMode;
          updateModeUi(nextMode);
          closeModeMenu();
          vscode.postMessage({ type: "setMode", mode: nextMode });
        });
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".mode-wrap")) {
          closeModeMenu();
        }
      });
      shareActEl.addEventListener("click",
        () => vscode.postMessage({ type: "pickFileToShare" }));
      modelBtnEl.addEventListener("click",
        () => vscode.postMessage({ type: "pickModel" }));
      document.getElementById("settings-btn").addEventListener("click",
        () => vscode.postMessage({ type: "exportTrail" }));

      // ── message bus ────────────────────────────────────────────────────────────

      window.addEventListener("message", (event) => {
        const msg = event.data;

        if (msg.type === "hydrate") {
          streamEl.innerHTML = "";
          if (!msg.payload.transcript || msg.payload.transcript.length === 0) {
            resetToWelcome();
          } else {
            msg.payload.transcript.forEach(renderEntry);
          }
          updateHeader(msg.payload);

          if (msg.payload.contextLabel) {
            contextBadge.textContent = msg.payload.contextLabel;
            contextBadge.classList.add("visible");
          }
          return;
        }

        if (msg.type === "append") {
          renderEntry(msg.entry);
          return;
        }

        if (msg.type === "patchLastAssistant") {
          patchLastAssistant(msg.text);
        }
      });

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
}
