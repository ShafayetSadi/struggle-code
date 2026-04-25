"use client";

import { FileText } from "lucide-react";
import { useMemo, useState } from "react";

type TrailPage = {
  id: string;
  fileName: string;
  project: string;
  intro: string;
  decisionTitle: string;
  decisionBody: string;
  checkpoints: string[];
  codeFile: string;
  codeSnippet: string[];
};

const TRAIL_PAGES: TrailPage[] = [
  {
    id: "auth",
    fileName: "STRUGGLE_LEARNING_TRAIL.md",
    project: "Auth-Bridge",
    intro: "This document tracks the technical evolution of Auth-Bridge. Decisions made through Socratic dialogue.",
    decisionTitle: "JWT vs Session Cookies",
    decisionBody:
      "Chose JWT because the system needs to be stateless for horizontal scaling. Acknowledged security risk: No easy way to revoke tokens without a blacklist.",
    checkpoints: [
      "Explained the difference between symmetric and asymmetric encryption.",
      "Mapped the OIDC handshake flow from scratch.",
      "Identified why bcrypt is preferred over SHA-256 for password hashing.",
    ],
    codeFile: "auth-middleware.ts",
    codeSnippet: [
      "// Derived from Dialogue #42",
      "export const verifyScope = (token) => {",
      "  // Logic for scope verification explained by user in PoU check.",
      "};",
    ],
  },
  {
    id: "queue",
    fileName: "PAYMENTS_SERVICE_TRAIL.md",
    project: "Queue-Pay",
    intro: "This document captures how Queue-Pay reached production-grade retries and observability.",
    decisionTitle: "Retry Queue vs Immediate Failure",
    decisionBody:
      "Chose delayed retries with capped backoff to reduce merchant-side failures while keeping duplicates measurable.",
    checkpoints: [
      "Explained idempotency keys and duplicate prevention strategy.",
      "Mapped retry budget behavior under upstream timeout spikes.",
      "Justified queue visibility timeout in relation to worker throughput.",
    ],
    codeFile: "retry-policy.ts",
    codeSnippet: [
      "// Derived from Dialogue #57",
      "export const computeRetryDelay = (attempt) => {",
      "  return Math.min(15000, 1000 * 2 ** attempt);",
      "};",
    ],
  },
  {
    id: "search",
    fileName: "SEARCH_PLATFORM_TRAIL.md",
    project: "Index-Signal",
    intro: "This document records indexing trade-offs and relevance tuning for the Index-Signal release.",
    decisionTitle: "Hybrid Ranking Strategy",
    decisionBody:
      "Combined BM25 with embedding reranking to preserve keyword precision while improving semantic recall.",
    checkpoints: [
      "Explained candidate-generation vs reranking responsibilities.",
      "Mapped stale index risks and backfill strategy.",
      "Defended latency budget split across retrieval and reranking.",
    ],
    codeFile: "ranker.ts",
    codeSnippet: [
      "// Derived from Dialogue #63",
      "export const blendScores = (lexical, semantic) => {",
      "  return lexical * 0.6 + semantic * 0.4;",
      "};",
    ],
  },
];

export function LearningTrailWindow() {
  const [activePageId, setActivePageId] = useState(TRAIL_PAGES[0]?.id ?? "");
  const activePage = useMemo(() => {
    return TRAIL_PAGES.find((page) => page.id === activePageId) ?? TRAIL_PAGES[0] ?? null;
  }, [activePageId]);

  if (!activePage) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#27272A] bg-[#121214]">
      <div className="flex items-center justify-between border-b border-[#27272A] bg-[#18181B] px-6 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-zinc-500" aria-hidden />
          <span className="font-mono text-xs uppercase tracking-widest text-white">{activePage.fileName}</span>
        </div>
        <div className="flex gap-2">
          {TRAIL_PAGES.map((page, idx) => {
            const isActive = page.id === activePage.id;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => setActivePageId(page.id)}
                aria-label={`Open ${page.fileName}`}
                className="rounded-full p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
              >
                <span
                  className={[
                    "block h-2.5 w-2.5 rounded-full",
                    isActive ? "bg-[#22C55E]" : "bg-[#22C55E]/35",
                    idx > 0 ? "opacity-85" : "",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="max-h-[500px] space-y-6 overflow-y-auto p-8 font-sans text-zinc-400">
        <h1 className="border-b border-[#27272A] pb-4 text-2xl font-bold text-white">Project: {activePage.project}</h1>
        <p>{activePage.intro}</p>
        <h2 className="mt-8 text-xl font-bold text-white">Decisions &amp; Trade-offs</h2>
        <div className="rounded border-l-4 border-[#22C55E] bg-[#18181B] p-4">
          <p className="mb-2 text-sm font-bold text-white">{activePage.decisionTitle}</p>
          <p className="text-sm">{activePage.decisionBody}</p>
        </div>
        <h2 className="mt-8 text-xl font-bold text-white">Knowledge Checkpoints</h2>
        <ul className="list-disc space-y-2 pl-6 text-sm">
          {activePage.checkpoints.map((checkpoint) => (
            <li key={checkpoint}>{checkpoint}</li>
          ))}
        </ul>
        <h2 className="mt-8 text-xl font-bold text-white">Code Reference</h2>
        <div className="overflow-hidden rounded-lg border border-[#27272A] bg-[#050505]">
          <div className="border-b border-[#27272A] bg-[#18181B] px-4 py-2">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">{activePage.codeFile}</span>
          </div>
          <pre className="p-4 font-mono text-xs text-zinc-300">
            <code>{activePage.codeSnippet.join("\n")}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
