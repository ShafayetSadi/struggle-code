"use client";

import { useState } from "react";

import { Check, Copy } from "lucide-react";

import { cn } from "../lib/utils";

export function InlineCopyRow({
  command,
  className,
  layout = "row",
  commandClassName,
}: {
  command: string;
  className?: string;
  layout?: "row" | "icon";
  commandClassName?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const btnClass =
    layout === "icon"
      ? "text-zinc-400 transition-colors hover:text-[#22C55E]"
      : "text-zinc-600 transition-colors hover:text-zinc-300";

  return (
    <div
      className={cn(
        layout === "row" && "flex w-full items-center justify-between gap-3",
        layout === "icon" && "flex shrink-0 items-center",
        className
      )}
    >
      {layout === "row" ? <span className={cn("text-[#22C55E]", commandClassName)}>{command}</span> : null}
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className={btnClass}
      >
        {copied ? <Check className="h-5 w-5 text-[#22C55E]" /> : <Copy className="h-5 w-5" />}
      </button>
    </div>
  );
}
