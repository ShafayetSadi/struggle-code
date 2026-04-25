import {
  Bolt,
  Brain,
  CheckCircle,
  Code,
  Copy,
  Download,
  GraduationCap,
  PlayCircle,
  Scale,
  Send,
  Terminal,
  User,
} from "lucide-react";

import { InlineCopyRow } from "../components/inline-copy-row";
import { LearningTrailWindow } from "../components/learning-trail-window";
import { SocratesLogo } from "../components/socrates-logo";

const CLI = "npm install -g @struggle-ai/cli";
const GITHUB_URL = "https://github.com/ShafayetSadi/struggle-code";
const NPM_URL = "https://www.npmjs.com/package/@struggle-ai/cli";
const VSCODE_URL = "https://marketplace.visualstudio.com/items?itemName=TonmayHossainJifat.struggle-ai-vscode";
const DOCS_URL = "https://github.com/ShafayetSadi/struggle-code/tree/main/docs";

const rateLimiterSnippet = `const rateLimiter = (req, res, next) => {
  const { limit, current } = checkLimit(req.ip);
  if (current > limit) {
    res.set('Retry-After', 60);
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
};`;

export default function Page() {
  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-[#27272A] bg-[#0A0A0B]">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-8">
          <a href="/" className="flex items-center gap-3">
            <SocratesLogo variant="nav" />
            <span className="font-mono text-xl font-bold tracking-tighter text-white">Struggle AI</span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a
              className="font-medium tracking-tight text-[#22C55E] transition-colors hover:text-white"
              href="/#product"
            >
              Product
            </a>
            <a
              className="font-medium tracking-tight text-zinc-400 transition-colors hover:text-white"
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
            >
              Docs
            </a>
            <a
              className="font-medium tracking-tight text-zinc-400 transition-colors hover:text-white"
              href="/#manifesto"
            >
              Manifesto
            </a>
            <div className="ml-4 flex items-center gap-3">
              <Terminal
                className="h-5 w-5 cursor-pointer text-zinc-400 transition-colors hover:text-white"
                aria-hidden
              />
              <a
                className="rounded-lg border border-[#27272A] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#121214]"
                href={NPM_URL}
                target="_blank"
                rel="noreferrer"
              >
                NPM
              </a>
              <a
                className="rounded-lg border border-[#27272A] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#121214]"
                href={VSCODE_URL}
                target="_blank"
                rel="noreferrer"
              >
                VS Code
              </a>
              <a
                className="rounded-lg bg-[#22C55E] px-4 py-1.5 text-sm font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90"
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section id="product" className="mx-auto grid max-w-[1440px] items-center gap-16 px-8 py-24 lg:grid-cols-2 lg:py-32">
          <div className="space-y-8">
            <h1 className="font-sans text-5xl font-extrabold leading-none tracking-tighter text-white lg:text-7xl">
              Stop shipping code you <span className="text-[#22C55E]">can&apos;t explain.</span>
            </h1>
            <p className="max-w-lg text-xl leading-relaxed text-zinc-400">
              We built Struggle AI around one belief: removing all friction from coding makes it easier to ship code
              you do not actually own.
            </p>
            <div className="max-w-xl rounded-xl border border-[#27272A] bg-[#121214] p-5">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#22C55E]">Our Thesis</p>
              <p className="mt-3 text-base leading-relaxed text-zinc-300">
                The best coding tools should not remove every obstacle. They should add deliberate cognitive friction at
                the moments where learning, ownership, and architectural clarity are at stake.
              </p>
            </div>
            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <a
                className="flex items-center justify-center gap-2 rounded-lg bg-[#22C55E] px-8 py-4 font-bold text-[#0A0A0B] transition-all hover:brightness-110"
                href={NPM_URL}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="h-5 w-5" aria-hidden />
                Install CLI
              </a>
              <a
                className="flex items-center justify-center gap-2 rounded-lg border border-[#27272A] px-8 py-4 font-bold text-white transition-all hover:bg-[#121214]"
                href={VSCODE_URL}
                target="_blank"
                rel="noreferrer"
              >
                <PlayCircle className="h-5 w-5" aria-hidden />
                VS Code Extension
              </a>
            </div>
            <div className="group flex max-w-md items-center justify-between rounded-lg border border-[#27272A] bg-[#121214] p-4 font-mono text-sm">
              <InlineCopyRow command={CLI} />
            </div>
          </div>

          <div className="relative">
            <div className="terminal-shadow overflow-hidden rounded-xl border border-[#27272A] bg-[#121214]">
              <div className="flex items-center gap-2 border-b border-[#27272A] bg-[#18181B] px-4 py-2">
                <div className="flex gap-1.5" aria-hidden>
                  <div className="h-3 w-3 rounded-full bg-[#FF5F56] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" />
                  <div className="h-3 w-3 rounded-full bg-[#FFBD2E] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" />
                  <div className="h-3 w-3 rounded-full bg-[#27C93F] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]" />
                </div>
                <div className="mx-auto font-mono text-xs uppercase tracking-widest text-zinc-500">zsh — struggle</div>
              </div>
              <div className="min-h-[400px] p-6 font-mono text-sm leading-relaxed">
                <div className="flex gap-2">
                  <span className="text-[#22C55E]">➜</span>
                  <span className="text-white">struggle init project-alpha</span>
                </div>
                <div className="mt-2 italic text-zinc-500">Analyzing architecture...</div>
                <div className="mt-4 text-[#22C55E]">
                  ? Struggle: Before we generate the API, how do you plan to handle state persistence?
                </div>
                <div className="mt-2 border-l-2 border-[#27272A] pl-4 text-zinc-400">
                  1) Redis (In-memory cache)
                  <br />
                  2) PostgreSQL (Relational)
                  <br />
                  3) I haven&apos;t decided yet
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="text-[#22C55E]">➜</span>
                  <span className="text-white">1</span>
                </div>
                <div className="mt-4 text-[#22C55E]">
                  ? Struggle: Excellent. Why Redis over a traditional SQL database for this specific microservice?
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-block h-4 w-2 animate-pulse bg-[#22C55E]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="manifesto" className="border-y border-[#27272A] bg-[#050505] py-32">
          <div className="mx-auto max-w-[1440px] px-8">
            <div className="grid gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)] lg:items-start">
              <div className="space-y-16">
                <div className="space-y-6">
                  <p className="font-mono text-sm uppercase tracking-[0.3em] text-[#22C55E]">The Crisis of Abstraction</p>
                  <h2 className="text-5xl font-bold tracking-tight text-white lg:text-7xl">
                    AI can write your code.
                    <br />
                    But can you explain it?
                  </h2>
                </div>
                <div className="grid gap-16 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white">&quot;Ghost in the Machine&quot;</h3>
                    <p className="leading-relaxed text-zinc-400">
                      Most developers today cannot debug what AI generates. We are becoming curators of magic boxes rather
                      than architects of systems.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white">Velocity vs. Understanding</h3>
                    <p className="leading-relaxed text-zinc-400">
                      Shipping 10x faster is useless if you&apos;re 10x slower at fixing the inevitable edge cases because
                      you don&apos;t understand the logic underneath.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-6 rounded-2xl border border-[#27272A] bg-[#121214] p-8 lg:sticky lg:top-24">
                <p className="font-mono text-sm uppercase tracking-[0.3em] text-[#22C55E]">Why This Is Friction</p>
                <p className="text-2xl font-bold leading-tight text-white">
                  We are not using friction as delay. We are using friction as a tool for comprehension.
                </p>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Interpretation</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Friction here is cognitive and educational, not mechanical slowdown.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Stance</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      Some friction in coding is not a bug. It is a feature when ownership is at stake.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Claim</div>
                    <p className="text-sm leading-relaxed text-zinc-400">
                      A codebase you cannot explain is not productivity. It is dependency.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-8 py-32">
          <div className="mb-16 space-y-4 text-center">
            <h2 className="text-4xl font-bold text-white md:text-5xl">
              Think Before You <span className="text-[#22C55E]">Build</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-zinc-400">
              Struggle AI asks the right questions before writing any code — so you understand what you&apos;re
              building, not just copy it.
            </p>
            <p className="mx-auto max-w-2xl text-sm uppercase tracking-[0.2em] text-zinc-500">
              The point is not to slow you down everywhere. The point is to slow you down exactly where understanding
              would otherwise be skipped.
            </p>
          </div>
          <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-[#27272A] bg-[#121214]">
            <div className="space-y-8 p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-800">
                  <User className="h-4 w-4 text-zinc-300" aria-hidden />
                </div>
                <div className="text-lg text-white">Build me a rate-limiting middleware for Express.</div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#22C55E]">
                  <Brain className="h-4 w-4 text-[#0A0A0B]" aria-hidden />
                </div>
                <div className="space-y-4">
                  <p className="leading-relaxed text-white">
                    Understood. But first: How should the system behave when a user exceeds the limit? Should we drop
                    requests silently, or return a 429 with a &apos;Retry-After&apos; header?
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="rounded border border-[#27272A] bg-[#18181B] px-3 py-1 text-xs text-zinc-400">
                      429 Header
                    </span>
                    <span className="rounded border border-[#27272A] bg-[#18181B] px-3 py-1 text-xs text-zinc-400">
                      Silent Drop
                    </span>
                    <span className="rounded border border-[#27272A] bg-[#18181B] px-3 py-1 text-xs text-zinc-400">
                      Queue &amp; Delay
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-zinc-800">
                  <User className="h-4 w-4 text-zinc-300" aria-hidden />
                </div>
                <div className="text-lg text-white">429 with header. We need to be transparent with API consumers.</div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#22C55E]">
                  <Code className="h-4 w-4 text-[#0A0A0B]" aria-hidden />
                </div>
                <div className="w-full overflow-hidden rounded-lg border border-[#27272A] bg-[#050505]">
                  <div className="flex items-center justify-between border-b border-[#27272A] bg-[#18181B] px-4 py-2">
                    <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">middleware.js</span>
                    <Copy className="h-4 w-4 cursor-pointer text-zinc-500 hover:text-white" aria-hidden />
                  </div>
                  <pre className="overflow-x-auto p-4 font-mono text-sm text-zinc-300">
                    <code>{rateLimiterSnippet}</code>
                  </pre>
                </div>
              </div>
            </div>
            <div className="flex gap-4 border-t border-[#27272A] bg-[#18181B] p-4">
              <input
                className="w-full border-none bg-transparent font-sans text-white placeholder:text-zinc-600 focus:ring-0 focus:outline-none"
                placeholder="Explain why you chose this implementation..."
                type="text"
              />
              <button type="button" className="text-[#22C55E]" aria-label="Send">
                <Send className="h-6 w-6" />
              </button>
            </div>
          </div>
        </section>

        <section className="border-t border-[#27272A] bg-[#0A0A0B] py-32">
          <div className="mx-auto max-w-[1440px] px-8">
            <div className="mb-16 space-y-4 text-center">
              <h2 className="text-4xl font-bold text-white md:text-5xl">
                Three Modes. One Goal: <span className="text-[#22C55E]">Understanding.</span>
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                From deep reasoning to fast execution — choose how you learn.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="group rounded-lg border border-[#27272A] p-8 transition-colors hover:border-[#22C55E]">
                <div className="mb-6 text-[#22C55E]">
                  <GraduationCap className="h-10 w-10" aria-hidden />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-white">Full Socratic</h3>
                <p className="mb-8 text-sm leading-relaxed text-zinc-400">
                  High friction, deep thinking. Struggle will refuse to generate code until you successfully explain the
                  architectural trade-offs of your request.
                </p>
                <div className="inline-flex items-center gap-2 rounded border border-[#27272A] bg-[#121214] px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
                  <span className="font-mono text-[10px] uppercase text-zinc-500">Maximum Learning</span>
                </div>
              </div>
              <div className="rounded-lg border border-[#22C55E]/30 bg-[#121214]/30 p-8 transition-colors">
                <div className="mb-6 text-[#22C55E]">
                  <Scale className="h-10 w-10" aria-hidden />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-white">Guided</h3>
                <p className="mb-8 text-sm leading-relaxed text-zinc-400">
                  Balanced approach. AI generates code alongside a &quot;Logic Map&quot; that explains the
                  &apos;Why&apos; behind every function and variable choice.
                </p>
                <div className="inline-flex items-center gap-2 rounded border border-[#22C55E]/20 bg-[#22C55E]/10 px-3 py-1">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-[#22C55E]" />
                  <span className="font-mono text-[10px] uppercase text-[#22C55E]">Recommended</span>
                </div>
              </div>
              <div className="group rounded-lg border border-[#27272A] p-8 transition-colors hover:border-[#22C55E]">
                <div className="mb-6 text-[#22C55E]">
                  <Bolt className="h-10 w-10" aria-hidden />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-white">Standard</h3>
                <p className="mb-8 text-sm leading-relaxed text-zinc-400">
                  Fast but reflective. Code is generated immediately, but you must complete a 15-second logic quiz to
                  unlock the &apos;Copy to Clipboard&apos; action.
                </p>
                <div className="inline-flex items-center gap-2 rounded border border-[#27272A] bg-[#121214] px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-zinc-500" />
                  <span className="font-mono text-[10px] uppercase text-zinc-500">Efficiency Focus</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="docs" className="mx-auto max-w-[1440px] px-8 py-32">
          <div className="grid gap-16 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-4">
              <h2 className="text-4xl font-bold leading-tight text-white">The Learning Trail</h2>
              <p className="leading-relaxed text-zinc-400">
                Every session can leave behind a living project artifact that records what you learned, which
                decisions you made, and which trade-offs you accepted.
              </p>
              <div className="space-y-4 pt-8">
                <div className="flex items-center gap-4 text-sm text-zinc-300">
                  <CheckCircle className="h-5 w-5 shrink-0 text-[#22C55E]" aria-hidden />
                  Proof of Understanding (PoU)
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-300">
                  <CheckCircle className="h-5 w-5 shrink-0 text-[#22C55E]" aria-hidden />
                  Decision Logs
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-300">
                  <CheckCircle className="h-5 w-5 shrink-0 text-[#22C55E]" aria-hidden />
                  Context Awareness
                </div>
              </div>
            </div>
            <div className="lg:col-span-8">
              <LearningTrailWindow />
            </div>
          </div>
        </section>

        <section className="bg-[#050505] py-32">
          <div className="mx-auto max-w-[1440px] px-8">
            <div className="mx-auto mb-20 max-w-3xl space-y-5 text-center">
              <p className="font-mono text-sm uppercase tracking-[0.3em] text-[#22C55E]">Deliberate Progress</p>
              <h2 className="text-4xl font-bold text-white md:text-5xl">
                The <span className="text-[#22C55E]">Struggle</span> Workflow
              </h2>
              <p className="text-lg leading-relaxed text-zinc-400">
                Struggle is not trying to slow down everything. It inserts friction at the exact points where reasoning,
                trade-offs, and ownership would normally be skipped.
              </p>
            </div>
            <div className="relative">
              <div
                className="pointer-events-none absolute left-0 top-8 hidden h-px w-full bg-gradient-to-r from-transparent via-[#22C55E]/25 to-transparent lg:block"
                aria-hidden
              />
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  n: "1",
                  t: "Ask",
                  d: "Start with a real problem, not a vague vibe. Bring the request into the CLI and make the target explicit.",
                },
                {
                  n: "2",
                  t: "Think",
                  d: "Struggle pushes back with clarifying questions so architecture, boundaries, and trade-offs are surfaced early.",
                },
                {
                  n: "3",
                  t: "Build",
                  d: "Implementation moves forward only after the plan is coherent enough to own, defend, and verify.",
                },
                {
                  n: "4",
                  t: "Export",
                  d: "Leave with code plus a Learning Trail that captures what you understood, not just what was generated.",
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="group relative overflow-hidden rounded-2xl border border-[#27272A] bg-[#121214] p-8 transition-all duration-200 hover:border-[#22C55E]/45 hover:bg-[#151816]"
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#22C55E]/35 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    aria-hidden
                  />
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#27272A] bg-[#18181B] text-xl font-bold text-[#22C55E] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                      {step.n}
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">Step {step.n}</div>
                  </div>
                  <h4 className="text-3xl font-bold tracking-tight text-white">{step.t}</h4>
                  <p className="mt-4 text-base leading-relaxed text-zinc-400">{step.d}</p>
                </div>
              ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-32">
          <div className="mx-auto max-w-[1440px] px-8">
            <div className="relative overflow-hidden rounded-[32px] border border-[#2d2d2d] bg-[#22C55E] p-10 shadow-[0_24px_80px_rgba(34,197,94,0.14)] lg:p-20">
              <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(#000 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)] lg:items-end">
                <div className="space-y-6 text-center lg:text-left">
                  <p className="font-mono text-sm uppercase tracking-[0.3em] text-[#0A0A0B]/65">Take A Stance</p>
                  <h2 className="text-4xl font-black tracking-tighter text-[#0A0A0B] lg:text-6xl">
                    Start building things you actually understand.
                  </h2>
                  <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#0A0A0B]/75 lg:mx-0">
                    If AI is going to write with you, it should also force you to think with it. Install Struggle and
                    make comprehension part of the workflow again.
                  </p>
                </div>
                <div className="rounded-[24px] border border-[#0A0A0B]/15 bg-[#0c0c0d] p-5 text-left shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#22C55E]/80">Install CLI</div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500">Terminal First</div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-black px-4 py-4 font-mono text-base text-white">
                    <span>$ {CLI}</span>
                    <InlineCopyRow command={CLI} layout="icon" />
                  </div>
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <a
                      className="rounded-xl bg-[#22C55E] px-6 py-4 font-bold text-[#0A0A0B] transition-transform hover:-translate-y-0.5 hover:brightness-105"
                      href={NPM_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Install CLI
                    </a>
                    <a
                      className="rounded-xl border border-white/10 bg-white/4 px-6 py-4 font-bold text-white transition-colors hover:bg-white/8"
                      href={DOCS_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read the Docs
                    </a>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                    Use AI as a mentor, not a vending machine. Ship the code and the reasoning behind it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#27272A] bg-[#0A0A0B]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-8 py-12 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <div className="flex items-center gap-3">
              <SocratesLogo variant="footer" />
              <div className="font-bold text-white">Struggle AI</div>
            </div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#22C55E]">Built for the terminal.</div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 font-mono text-xs uppercase tracking-widest text-zinc-500">
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href={DOCS_URL} target="_blank" rel="noreferrer">
              Documentation
            </a>
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href={NPM_URL} target="_blank" rel="noreferrer">
              NPM
            </a>
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href={VSCODE_URL} target="_blank" rel="noreferrer">
              VS Code
            </a>
          </div>
          <div className="text-center font-mono text-xs text-zinc-500 md:text-right">
            © 2026 Struggle AI. Built with ❤️ during the FRICTION Hackathon.
          </div>
        </div>
      </footer>
    </>
  );
}
