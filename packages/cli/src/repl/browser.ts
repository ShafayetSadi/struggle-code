import { spawn } from "node:child_process";
import * as process from "node:process";

function runBrowserCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
      detached: process.platform !== "win32",
    });

    child.on("error", reject);
    child.on("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export async function openUrlInBrowser(url: string): Promise<void> {
  if (process.platform === "darwin") {
    await runBrowserCommand("open", [url]);
    return;
  }

  if (process.platform === "win32") {
    await runBrowserCommand("cmd", ["/c", "start", "", url]);
    return;
  }

  try {
    await runBrowserCommand("xdg-open", [url]);
    return;
  } catch {}

  try {
    await runBrowserCommand("gio", ["open", url]);
    return;
  } catch {}

  await runBrowserCommand("wslview", [url]);
}
