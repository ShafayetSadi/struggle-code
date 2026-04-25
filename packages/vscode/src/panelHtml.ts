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
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Struggle AI</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d0d0d;
        --panel: #111111;
        --surface: #181818;
        --surface-2: #1e1e1e;
        --border: rgba(255,255,255,0.07);
        --border-mid: rgba(255,255,255,0.12);
        --text: #e2e2e2;
        --muted: #888;
        --muted-2: #555;
        --accent: #3ddc84;
        --accent-dim: rgba(61,220,132,0.12);
        --accent-glow: rgba(61,220,132,0.08);
        --user-bg: #1c1c1c;
        --hint-color: #3ddc84;
        --stuck-color: #e05555;
        --system-bg: #13161d;
        --system-border: rgba(100,140,220,0.18);
        --error-bg: #180f0f;
        --error-border: rgba(200,60,60,0.25);
        font-family: ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      html, body {
        height: 100%;
        background: var(--bg);
        color: var(--text);
        overflow: hidden;
      }

      body {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }

      /* ── HEADER ── */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 14px;
        height: 42px;
        border-bottom: 1px solid var(--border);
        background: var(--panel);
        flex-shrink: 0;
        gap: 8px;
      }

      .logo {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.14em;
        color: var(--text);
        text-transform: uppercase;
        white-space: nowrap;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .mode-select {
        display: flex;
        align-items: center;
        padding: 4px 10px;
        border: 1px solid var(--border-mid);
        border-radius: 20px;
        background: var(--surface);
        color: var(--text);
        font-size: 12px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        appearance: none;
        outline: none;
        transition: border-color 0.15s;
      }

      .mode-select:hover, .mode-select:focus { border-color: var(--accent); }

      .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        border-radius: 6px;
        transition: color 0.15s, background 0.15s;
      }

      .icon-btn:hover { color: var(--text); background: var(--surface-2); }

      /* ── STAGE ── */
      .stage {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: thin;
        scrollbar-color: var(--surface-2) transparent;
        position: relative;
      }

      .stage::-webkit-scrollbar { width: 4px; }
      .stage::-webkit-scrollbar-track { background: transparent; }
      .stage::-webkit-scrollbar-thumb { background: var(--surface-2); border-radius: 2px; }

      /* ── WELCOME STATE ── */
      .welcome {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100%;
        padding: 32px 20px;
        text-align: center;
        gap: 12px;
      }

      .robot-icon { width: 60px; height: 60px; margin-bottom: 8px; }

      .welcome-title {
        font-size: 19px;
        font-weight: 600;
        color: var(--text);
        letter-spacing: -0.01em;
      }

      .welcome-sub {
        font-size: 13px;
        color: var(--muted);
      }

      .welcome-sub .cmd {
        color: var(--accent);
        font-family: ui-monospace,monospace;
        font-size: 12px;
      }

      .suggestion-cards {
        display: flex;
        gap: 10px;
        margin-top: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .suggestion-card {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 14px 16px;
        border: 1px solid var(--border-mid);
        border-radius: 10px;
        background: var(--surface);
        cursor: pointer;
        text-align: left;
        width: 152px;
        transition: border-color 0.15s, background 0.15s;
        font-family: inherit;
        color: inherit;
      }

      .suggestion-card:hover {
        border-color: var(--accent);
        background: var(--accent-glow);
      }

      .card-icon {
        font-size: 15px;
        color: var(--accent);
        margin-bottom: 2px;
        font-family: ui-monospace, monospace;
        font-weight: 600;
      }

      .card-title { font-size: 12px; font-weight: 600; color: var(--text); }
      .card-sub { font-size: 11px; color: var(--muted); line-height: 1.4; }

      /* ── STREAM / MESSAGES ── */
      .stream {
        display: flex;
        flex-direction: column;
        padding: 12px 0 8px;
      }

      .message { padding: 6px 18px; display: flex; flex-direction: column; }

      .message.user { align-items: flex-end; }

      .message.user .body {
        background: var(--user-bg);
        border: 1px solid rgba(255,255,255,0.09);
        border-radius: 12px 2px 12px 12px;
        padding: 9px 13px;
        max-width: 78%;
        font-size: 14px;
        line-height: 1.6;
        color: var(--text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .message.assistant { align-items: flex-start; }

      .ai-label {
        font-size: 10px;
        font-weight: 700;
        color: var(--accent);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        gap: 3px;
      }

      .ai-label::after { content: "›"; font-size: 12px; }

      .message.assistant .body {
        font-size: 14px;
        line-height: 1.75;
        color: var(--text);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .assistant-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .action-btn {
        padding: 3px 11px;
        border-radius: 4px;
        border: 1px solid;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.07em;
        cursor: pointer;
        background: transparent;
        font-family: inherit;
        transition: background 0.15s;
      }

      .action-btn.hint { color: var(--hint-color); border-color: rgba(61,220,132,0.3); }
      .action-btn.hint:hover { background: rgba(61,220,132,0.1); }
      .action-btn.stuck { color: var(--stuck-color); border-color: rgba(224,85,85,0.3); }
      .action-btn.stuck:hover { background: rgba(224,85,85,0.1); }

      /* code blocks */
      .code-block {
        margin-top: 10px;
        border: 1px solid var(--border-mid);
        border-radius: 8px;
        overflow: hidden;
      }

      .code-header {
        display: flex;
        align-items: center;
        padding: 5px 12px;
        background: var(--surface-2);
        border-bottom: 1px solid var(--border);
        font-size: 11px;
        color: var(--muted);
        font-family: ui-monospace, monospace;
        gap: 6px;
      }

      .code-header-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--border-mid);
        flex-shrink: 0;
      }

      .code-body {
        padding: 12px;
        background: var(--surface);
        font-family: ui-monospace,SFMono-Regular,Consolas,monospace;
        font-size: 12.5px;
        line-height: 1.6;
        color: var(--text);
        overflow-x: auto;
        white-space: pre;
      }

      code {
        border: 1px solid var(--border-mid);
        border-radius: 4px;
        background: var(--surface-2);
        padding: 1px 5px;
        font-family: ui-monospace,SFMono-Regular,Consolas,monospace;
        font-size: 12.5px;
      }

      .message.system { padding: 4px 18px; }
      .message.system .body {
        background: var(--system-bg);
        border: 1px solid var(--system-border);
        border-radius: 8px;
        padding: 9px 13px;
        font-size: 13px;
        color: #a0b4e0;
        white-space: pre-wrap;
      }

      .message.error .body {
        background: var(--error-bg);
        border: 1px solid var(--error-border);
        border-radius: 8px;
        padding: 9px 13px;
        color: #e57373;
        white-space: pre-wrap;
      }

      /* ── SLASH COMMAND POPUP ── */
      .slash-popup {
        position: absolute;
        bottom: 0;
        left: 16px;
        right: 16px;
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: 10px;
        overflow: hidden;
        display: none;
        z-index: 20;
        box-shadow: 0 8px 28px rgba(0,0,0,0.6);
        margin-bottom: 4px;
      }

      .slash-popup.open { display: block; }

      .slash-popup-header {
        padding: 6px 12px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted-2);
        border-bottom: 1px solid var(--border);
      }

      .slash-cmd {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.1s;
      }

      .slash-cmd:hover, .slash-cmd.active { background: var(--surface-2); }

      .slash-cmd-icon {
        width: 24px; height: 24px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 700; flex-shrink: 0;
      }

      .slash-cmd-icon.green { background: rgba(61,220,132,0.15); color: var(--accent); }
      .slash-cmd-icon.yellow { background: rgba(220,180,61,0.15); color: #dcc43d; }
      .slash-cmd-icon.red { background: rgba(224,85,85,0.15); color: var(--stuck-color); }

      .slash-cmd-info { flex: 1; min-width: 0; }
      .slash-cmd-name { font-size: 12px; font-weight: 600; color: var(--text); }
      .slash-cmd-desc { font-size: 11px; color: var(--muted); }

      .slash-cmd-enter {
        font-size: 10px;
        padding: 2px 6px;
        border: 1px solid var(--border-mid);
        border-radius: 4px;
        color: var(--muted-2);
        flex-shrink: 0;
      }

      /* ── INPUT BAR ── */
      .input-bar {
        flex-shrink: 0;
        border-top: 1px solid var(--border);
        background: var(--surface);
        padding: 10px 14px 10px;
      }

      .input-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }

      .attach-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        border-radius: 6px;
        flex-shrink: 0;
        transition: color 0.15s;
      }

      .attach-btn:hover { color: var(--text); }

      .composer-wrap { flex: 1; min-width: 0; }

      .composer-input {
        width: 100%;
        border: 0;
        outline: none;
        resize: none;
        background: transparent;
        color: var(--text);
        padding: 4px 0;
        line-height: 1.5;
        font-size: 14px;
        font-family: inherit;
        min-height: 24px;
        max-height: 120px;
        overflow-y: auto;
        display: block;
        scrollbar-width: thin;
      }

      .composer-input::placeholder { color: var(--muted-2); }

      .send-button {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 6px 14px;
        border: 0;
        border-radius: 8px;
        background: var(--accent);
        color: #0a0a0a;
        font-size: 12px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        flex-shrink: 0;
        letter-spacing: 0.03em;
        transition: opacity 0.15s;
        height: 30px;
      }

      .send-button:disabled { opacity: 0.35; cursor: not-allowed; }
      .send-button:hover:not(:disabled) { opacity: 0.88; }

      .input-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        padding-left: 38px;
      }

      .model-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 9px;
        border: 1px solid var(--border-mid);
        border-radius: 20px;
        font-size: 11px;
        color: var(--muted);
        cursor: pointer;
        background: transparent;
        font-family: inherit;
        transition: border-color 0.15s, color 0.15s;
      }

      .model-chip:hover { border-color: var(--accent); color: var(--accent); }

      .context-badge {
        display: none;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.07em;
        color: var(--muted-2);
        text-transform: uppercase;
        padding: 2px 7px;
        border: 1px solid var(--border);
        border-radius: 4px;
        white-space: nowrap;
      }

      .context-badge.visible { display: inline-block; }
    </style>
  </head>
  <body>

    <!-- HEADER -->
    <header class="header">
      <span class="logo">Struggle AI</span>
      <div class="header-right">
        <select class="mode-select" id="mode-select" aria-label="Session mode">
          <option value="guided">Guided Mode</option>
          <option value="standard">Standard Mode</option>
          <option value="socratic">Socratic Mode</option>
        </select>
        <button class="icon-btn" id="settings-btn" title="More options" aria-label="More options">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.3"/>
            <circle cx="8" cy="8" r="1.3"/>
            <circle cx="8" cy="13" r="1.3"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- STAGE -->
    <div class="stage" id="stage">

      <!-- Welcome state -->
      <div class="welcome" id="welcome-state">
        <svg class="robot-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="17" y="23" width="30" height="26" rx="4" fill="#0f1f14" stroke="#3ddc84" stroke-width="1.5"/>
          <rect x="25" y="31" width="5" height="5" rx="1" fill="#3ddc84" opacity="0.95"/>
          <rect x="34" y="31" width="5" height="5" rx="1" fill="#3ddc84" opacity="0.95"/>
          <path d="M26 42h12" stroke="#3ddc84" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>
          <rect x="28" y="15" width="8" height="10" rx="2" fill="#0f1f14" stroke="#3ddc84" stroke-width="1.5"/>
          <circle cx="32" cy="13.5" r="2.5" fill="#3ddc84"/>
          <rect x="11" y="29" width="6" height="11" rx="2" fill="#0f1f14" stroke="#3ddc84" stroke-width="1.5"/>
          <rect x="47" y="29" width="6" height="11" rx="2" fill="#0f1f14" stroke="#3ddc84" stroke-width="1.5"/>
          <rect x="22" y="49" width="6" height="8" rx="2" fill="#0f1f14" stroke="#3ddc84" stroke-width="1.5"/>
          <rect x="36" y="49" width="6" height="8" rx="2" fill="#0f1f14" stroke="#3ddc84" stroke-width="1.5"/>
        </svg>
        <h1 class="welcome-title">Think before you build.</h1>
        <p class="welcome-sub">Ask a question or use <span class="cmd">/help</span> to get started</p>
        <div class="suggestion-cards">
          <button class="suggestion-card" id="card-arch" type="button">
            <span class="card-icon">&lt;/&gt;</span>
            <span class="card-title">Analyze Architecture</span>
            <span class="card-sub">Review current project structure</span>
          </button>
          <button class="suggestion-card" id="card-debug" type="button">
            <span class="card-icon">&#9889;</span>
            <span class="card-title">Debug Session</span>
            <span class="card-sub">Find bottlenecks in your logic</span>
          </button>
        </div>
      </div>

      <!-- Chat messages -->
      <div class="stream" id="stream" style="display:none;"></div>

      <!-- Slash popup (anchored to bottom of stage) -->
      <div class="slash-popup" id="slash-popup">
        <div class="slash-popup-header">Available Commands</div>
      </div>

    </div>

    <!-- INPUT BAR -->
    <div class="input-bar">
      <div class="input-row">
        <button class="attach-btn" id="share-active-btn" aria-label="Attach file">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.51 3.83a4.1 4.1 0 0 0-5.8 0L2.4 9.14a2.87 2.87 0 0 0 4.06 4.06l4.25-4.25a.5.5 0 0 0-.7-.71L5.76 12.5a1.87 1.87 0 1 1-2.64-2.65l5.3-5.3a3.1 3.1 0 1 1 4.38 4.38l-4.6 4.6a.5.5 0 0 0 .7.71l4.6-4.6a4.1 4.1 0 0 0 0-5.81z"/>
          </svg>
        </button>
        <div class="composer-wrap">
          <textarea
            class="composer-input"
            id="input"
            placeholder="Ask about your code..."
            rows="1"
            aria-label="Message input"
          ></textarea>
        </div>
        <button class="send-button" id="send-btn" type="button">
          Send
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M1 7h12M7.5 1.5l6 5.5-6 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="input-meta">
        <button class="model-chip" id="model-btn" type="button" aria-label="Change model">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.2"/>
            <circle cx="5" cy="5" r="1.5" fill="currentColor"/>
          </svg>
          <span id="model-label">Struggle-1.0</span>
        </button>
        <span class="context-badge" id="context-badge"></span>
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
        streamEl.style.flexDirection = "column";
      }

      function resetToWelcome() {
        streamEl.innerHTML = "";
        streamEl.style.display  = "none";
        welcomeEl.style.display = "";
      }

      function setBusy(busy) {
        sendBtnEl.disabled    = busy;
        modeSelectEl.disabled = busy;
        shareActEl.disabled   = busy;
        modelBtnEl.disabled   = busy;
      }

      function updateHeader(payload) {
        modeSelectEl.value = payload.mode || "guided";
        if (payload.providerLabel) modelLabelEl.textContent = payload.providerLabel;
        setBusy(!!payload.busy);
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
        if (e.key === "Escape") closeSlashPopup();
      });

      sendBtnEl.addEventListener("click", () => sendValue(inputEl.value));

      document.getElementById("card-arch").addEventListener("click",
        () => sendValue("Analyze the architecture of this project"));
      document.getElementById("card-debug").addEventListener("click",
        () => sendValue("Help me start a debug session"));

      modeSelectEl.addEventListener("change",
        () => vscode.postMessage({ type: "setMode", mode: modeSelectEl.value }));
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
