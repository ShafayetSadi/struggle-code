import * as process from "node:process";

const ESC = "\u001B";
const OSC8_ST = `${ESC}\\`;

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function isTruthy(value: string | undefined): boolean {
  return value ? TRUE_VALUES.has(value.toLowerCase()) : false;
}

export function supportsOsc8Hyperlinks(): boolean {
  if (!process.stdout.isTTY) {
    return false;
  }

  if (isTruthy(process.env.PI_FORCE_HYPERLINKS) || isTruthy(process.env.FORCE_HYPERLINK)) {
    return true;
  }

  if (isTruthy(process.env.PI_DISABLE_HYPERLINKS) || isTruthy(process.env.NO_HYPERLINK)) {
    return false;
  }

  const term = process.env.TERM ?? "";
  if (term === "dumb") {
    return false;
  }

  const termProgram = process.env.TERM_PROGRAM ?? "";
  if (["iTerm.app", "WezTerm", "vscode"].includes(termProgram)) {
    return true;
  }

  if (process.env.WT_SESSION || process.env.KONSOLE_VERSION) {
    return true;
  }

  const vteVersion = Number.parseInt(process.env.VTE_VERSION ?? "", 10);
  if (Number.isFinite(vteVersion) && vteVersion >= 5000) {
    return true;
  }

  if (/kitty|xterm-kitty|ghostty|foot|tmux|screen|xterm|rxvt|alacritty/i.test(term)) {
    return true;
  }

  return false;
}

export function createOsc8Hyperlink(url: string, text: string): string {
  return `${ESC}]8;;${url}${OSC8_ST}${text}${ESC}]8;;${OSC8_ST}`;
}

export function formatTerminalLink(url: string, text: string): string {
  if (!supportsOsc8Hyperlinks()) {
    return `${text}: ${url}`;
  }
  return createOsc8Hyperlink(url, text);
}

export function shortenMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength || maxLength < 8) {
    return value;
  }

  const head = Math.max(3, Math.floor((maxLength - 1) / 2));
  const tail = Math.max(3, maxLength - 1 - head);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
