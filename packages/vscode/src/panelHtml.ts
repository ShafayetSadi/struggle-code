export function getPanelHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Struggle AI</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      body {
        margin: 0;
        padding: 24px;
        background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
        color: #e5e7eb;
      }
      .panel {
        max-width: 720px;
        margin: 0 auto;
        padding: 24px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.92);
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
      }
      .composer {
        display: flex;
        gap: 12px;
        margin-top: 20px;
      }
      input {
        flex: 1;
        border-radius: 10px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: #0b1120;
        color: #f8fafc;
        padding: 10px 12px;
      }
      button {
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        background: #22c55e;
        color: #052e16;
        font-weight: 700;
        cursor: pointer;
      }
      .hint {
        color: #94a3b8;
        font-size: 0.95rem;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <h1>Struggle AI — hello world. Chat UI coming soon.</h1>
      <p class="hint">This placeholder panel exists so the extension host can activate, render, and accept future webview wiring.</p>
      <div class="composer">
        <input type="text" placeholder="Ask Struggle AI about your current task..." />
        <button type="button">Send</button>
      </div>
    </main>
  </body>
</html>`;
}
