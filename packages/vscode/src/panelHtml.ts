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
        --bg: #0c0c0c;
        --panel: #111111;
        --surface: #181818;
        --surface-2: #1e1e1e;
        --border: rgba(255, 255, 255, 0.07);
        --border-mid: rgba(255, 255, 255, 0.11);
        --text: #e2e2e2;
        --muted: #888;
        --muted-2: #555;
        --accent: #c8956c;
        --accent-glow: rgba(200, 149, 108, 0.15);
        --user-bg: #1a1714;
        --user-border: rgba(200, 149, 108, 0.18);
        --assistant-bg: #131313;
        --system-bg: #13161d;
        --system-border: rgba(100, 140, 220, 0.18);
        --error-bg: #180f0f;
        --error-border: rgba(200, 60, 60, 0.25);
        --shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
        font-family:
          ui-sans-serif,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
        background: var(--bg);
        color: var(--text);
      }

      body {
        min-height: 100vh;
        padding: 16px;
      }

      .frame {
        display: grid;
        grid-template-columns: 1fr 130px;
        grid-template-rows: 52px minmax(320px, 1fr) 56px;
        min-height: calc(100vh - 32px);
        border: 1px solid var(--border-mid);
        border-radius: 10px;
        background: var(--panel);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .toolbar {
        grid-column: 1 / 2;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 8px 12px;
        border-right: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        background: var(--panel);
      }

      .mode-box {
        grid-column: 2 / 3;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border);
        background: var(--panel);
      }

      .mode-select {
        width: 100%;
        border: 1px solid var(--border-mid);
        border-radius: 6px;
        outline: none;
        background: var(--surface);
        color: var(--accent);
        text-align: center;
        text-transform: lowercase;
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.04em;
        appearance: none;
        padding: 5px 8px;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
      }

      .mode-select:hover,
      .mode-select:focus {
        border-color: var(--accent);
        background: var(--accent-glow);
      }

      .stage {
        grid-column: 1 / 3;
        min-height: 0;
        overflow: hidden;
        background: var(--panel);
      }

      .transcript {
        height: 100%;
        overflow-y: auto;
        padding: 20px 18px;
        scrollbar-width: thin;
        scrollbar-color: var(--surface-2) transparent;
      }

      .transcript::-webkit-scrollbar {
        width: 4px;
      }

      .transcript::-webkit-scrollbar-track {
        background: transparent;
      }

      .transcript::-webkit-scrollbar-thumb {
        background: var(--surface-2);
        border-radius: 2px;
      }

      .stream {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 100%;
      }

      .empty {
        border: 1px dashed var(--border-mid);
        border-radius: 8px;
        padding: 18px 20px;
        color: var(--muted);
        line-height: 1.7;
        max-width: 720px;
        background: var(--surface);
      }

      .bottom-left {
        grid-column: 1 / 2;
        display: grid;
        grid-template-columns: 48px 1fr 110px;
        min-height: 56px;
        border-top: 1px solid var(--border);
        border-right: 1px solid var(--border);
        background: var(--surface);
      }

      .plus-box,
      .input-box,
      .model-box,
      .send-box {
        min-height: 56px;
      }

      .plus-box,
      .model-box {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .plus-box {
        border-right: 1px solid var(--border);
      }

      .input-box {
        background: transparent;
      }

      .model-box {
        border-left: 1px solid var(--border);
      }

      .send-box {
        grid-column: 2 / 3;
        display: flex;
        align-items: center;
        justify-content: center;
        border-top: 1px solid var(--border);
        background: var(--surface);
      }

      button,
      select,
      textarea {
        font: inherit;
      }

      .tool-button,
      .plus-button,
      .model-button,
      .send-button {
        border: 0;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        transition: color 0.15s, background 0.15s;
      }

      .tool-button {
        padding: 6px 10px;
        border-radius: 6px;
        text-transform: lowercase;
        font-weight: 500;
        font-size: 13px;
        letter-spacing: 0.01em;
      }

      .tool-button:hover {
        color: var(--text);
        background: var(--surface-2);
      }

      .plus-button:hover,
      .model-button:hover {
        color: var(--accent);
      }

      .send-button:hover {
        color: var(--bg);
        background: color-mix(in srgb, var(--accent) 80%, white);
      }

      .plus-button,
      .model-button {
        width: 100%;
        height: 100%;
        font-size: 13px;
        font-weight: 500;
      }

      .plus-button {
        font-size: 20px;
        font-weight: 300;
        color: var(--muted-2);
      }

      .send-button {
        width: calc(100% - 16px);
        height: calc(100% - 14px);
        border-radius: 7px;
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.02em;
        background: var(--accent);
        color: var(--bg);
        border: 0;
        transition: opacity 0.15s, background 0.15s;
      }

      .send-button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }

      .composer-input {
        width: 100%;
        height: 100%;
        border: 0;
        outline: none;
        resize: none;
        background: transparent;
        color: var(--text);
        padding: 16px 14px;
        line-height: 1.5;
        font-size: 14px;
      }

      .composer-input::placeholder {
        color: var(--muted-2);
      }

      .message {
        max-width: 800px;
      }

      .message.user {
        align-self: flex-end;
        width: min(80%, 800px);
      }

      .label {
        display: block;
        margin-bottom: 6px;
        color: var(--muted-2);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .body {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--assistant-bg);
        padding: 12px 14px;
        white-space: pre-wrap;
        line-height: 1.7;
        font-size: 14px;
      }

      .message.user .body {
        background: var(--user-bg);
        border-color: var(--user-border);
        border-radius: 8px 2px 8px 8px;
      }

      .message.system .body {
        background: var(--system-bg);
        border-color: var(--system-border);
      }

      .message.error .body {
        background: var(--error-bg);
        border-color: var(--error-border);
        color: #e57373;
      }

      code {
        border: 1px solid var(--border-mid);
        border-radius: 4px;
        background: var(--surface-2);
        padding: 1px 5px;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 12.5px;
      }

      .model-button {
        font-size: 11px;
        color: var(--muted-2);
        letter-spacing: 0.01em;
        padding: 0 10px;
        text-align: center;
        word-break: break-word;
        line-height: 1.3;
      }

      @media (max-width: 720px) {
        body {
          padding: 8px;
        }

        .frame {
          grid-template-columns: 1fr;
          grid-template-rows: auto auto minmax(320px, 1fr) auto auto;
          min-height: calc(100vh - 16px);
          border-radius: 8px;
        }

        .toolbar,
        .mode-box,
        .bottom-left,
        .send-box {
          grid-column: 1 / 2;
          border-right: 0;
        }

        .toolbar {
          flex-wrap: wrap;
        }

        .mode-box {
          border-top: 0;
        }

        .stage {
          grid-column: 1 / 2;
        }

        .bottom-left {
          grid-template-columns: 48px 1fr;
        }

        .model-box {
          grid-column: 1 / 3;
          border-left: 0;
          border-top: 1px solid var(--border);
        }

        .message.user {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main class="frame">
      <section class="toolbar">
        <button class="tool-button" id="hint-btn" type="button">Hint</button>
        <button class="tool-button" id="stuck-btn" type="button">stuck</button>
        <button class="tool-button" id="share-btn" type="button">share</button>
        <button class="tool-button" id="export-btn" type="button">export</button>
      </section>

      <section class="mode-box">
        <select class="mode-select" id="mode-select" aria-label="Session mode">
          <option value="guided">guided</option>
          <option value="standard">standard</option>
          <option value="socratic">socratic</option>
        </select>
      </section>

      <section class="stage">
        <section class="transcript" id="transcript" aria-live="polite">
          <div class="stream" id="stream">
            <div class="empty" id="empty-state">
              This panel uses the same shared-core session as the CLI.
              Try <code>/help</code>, <code>/hint</code>, <code>/stuck</code>, or ask about the current workspace.
            </div>
          </div>
        </section>
      </section>

      <section class="bottom-left">
        <div class="plus-box">
          <button class="plus-button" id="share-active-btn" type="button" aria-label="Pick file to share">+</button>
        </div>
        <div class="input-box">
          <textarea
            class="composer-input"
            id="input"
            placeholder="Ask for follow-up changes"
          ></textarea>
        </div>
        <div class="model-box">
          <button class="model-button" id="model-btn" type="button">change model</button>
        </div>
      </section>

      <section class="send-box">
        <button class="send-button" id="send-btn" type="button">Send</button>
      </section>
    </main>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const transcript = document.getElementById("transcript");
      const stream = document.getElementById("stream");
      const emptyState = document.getElementById("empty-state");
      const input = document.getElementById("input");
      const sendBtn = document.getElementById("send-btn");
      const hintBtn = document.getElementById("hint-btn");
      const stuckBtn = document.getElementById("stuck-btn");
      const shareBtn = document.getElementById("share-btn");
      const exportBtn = document.getElementById("export-btn");
      const modeSelect = document.getElementById("mode-select");
      const shareActiveBtn = document.getElementById("share-active-btn");
      const modelBtn = document.getElementById("model-btn");

      function scrollToBottom() {
        transcript.scrollTop = transcript.scrollHeight;
      }

      function setBusy(busy) {
        sendBtn.disabled = busy;
        hintBtn.disabled = busy;
        stuckBtn.disabled = busy;
        shareBtn.disabled = busy;
        exportBtn.disabled = busy;
        modeSelect.disabled = busy;
        shareActiveBtn.disabled = busy;
        modelBtn.disabled = busy;
      }

      function updateHeader(payload) {
        modeSelect.value = payload.mode;
        modelBtn.textContent = payload.providerLabel;
        setBusy(payload.busy);
      }

      function renderEntry(entry) {
        const node = document.createElement("article");
        node.className = "message " + entry.role;
        node.innerHTML = "<span class=\\"label\\">" + entry.role + "</span><div class=\\"body\\"></div>";
        node.querySelector(".body").textContent = entry.text;
        stream.appendChild(node);
        if (emptyState.isConnected) {
          emptyState.remove();
        }
        scrollToBottom();
      }

      function patchLastAssistant(text) {
        const last = stream.querySelector(".message.assistant:last-of-type .body");
        if (!last) {
          renderEntry({ role: "assistant", text });
          return;
        }
        last.textContent += text;
        scrollToBottom();
      }

      function sendValue(value) {
        const trimmed = value.trim();
        if (!trimmed) return;
        vscode.postMessage({ type: "send", value: trimmed });
        input.value = "";
      }

      sendBtn.addEventListener("click", () => sendValue(input.value));

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendValue(input.value);
        }
      });

      hintBtn.addEventListener("click", () => vscode.postMessage({ type: "hint", level: 1 }));
      stuckBtn.addEventListener("click", () => vscode.postMessage({ type: "stuck" }));
      shareBtn.addEventListener("click", () => vscode.postMessage({ type: "shareActiveFile" }));
      exportBtn.addEventListener("click", () => vscode.postMessage({ type: "exportTrail" }));
      shareActiveBtn.addEventListener("click", () => vscode.postMessage({ type: "pickFileToShare" }));
      modeSelect.addEventListener("change", () => vscode.postMessage({ type: "setMode", mode: modeSelect.value }));
      modelBtn.addEventListener("click", () => vscode.postMessage({ type: "pickModel" }));

      window.addEventListener("message", (event) => {
        const message = event.data;
        if (message.type === "hydrate") {
          stream.innerHTML = "";
          if (message.payload.transcript.length === 0) {
            stream.appendChild(emptyState);
          } else {
            message.payload.transcript.forEach(renderEntry);
          }
          updateHeader(message.payload);
          return;
        }

        if (message.type === "append") {
          renderEntry(message.entry);
          return;
        }

        if (message.type === "patchLastAssistant") {
          patchLastAssistant(message.text);
        }
      });

      vscode.postMessage({ type: "ready" });
    </script>
  </body>
</html>`;
}
