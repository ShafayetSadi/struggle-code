import {
  Bolt,
  Brain,
  CheckCircle,
  Code,
  Copy,
  Download,
  FileText,
  GraduationCap,
  PlayCircle,
  Scale,
  Send,
  Terminal,
  User,
} from "lucide-react";

import { InlineCopyRow } from "../components/inline-copy-row";
import { SocratesLogo } from "../components/socrates-logo";

const CLI = "npm install -g @socrates-ai/cli";

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
            <span className="font-mono text-xl font-bold tracking-tighter text-white">Socrates AI</span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            <a
              className="font-medium tracking-tight text-[#22C55E] transition-colors hover:text-white"
              href="/#product"
            >
              Product
            </a>
            <a className="font-medium tracking-tight text-zinc-400 transition-colors hover:text-white" href="/#docs">
              Docs
            </a>
            <a
              className="font-medium tracking-tight text-zinc-400 transition-colors hover:text-white"
              href="/#manifesto"
            >
              Manifesto
            </a>
            <div className="ml-4 flex items-center gap-4">
              <Terminal
                className="h-5 w-5 cursor-pointer text-zinc-400 transition-colors hover:text-white"
                aria-hidden
              />
              <button
                type="button"
                className="rounded-lg bg-[#22C55E] px-4 py-1.5 text-sm font-semibold text-[#0A0A0B] transition-opacity hover:opacity-90"
              >
                GitHub
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="mx-auto grid max-w-[1440px] items-center gap-16 px-8 py-24 lg:grid-cols-2 lg:py-32">
          <div className="space-y-8">
            <h1 className="font-sans text-5xl font-extrabold leading-none tracking-tighter text-white lg:text-7xl">
              Stop shipping code you <span className="text-[#22C55E]">can&apos;t explain.</span>
            </h1>
            <p className="max-w-lg text-xl leading-relaxed text-zinc-400">
              Most AI tools remove friction. Socrates AI adds the right friction so you actually understand what you
              build.
            </p>
            <div className="flex flex-col gap-4 pt-4 sm:flex-row">
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-lg bg-[#22C55E] px-8 py-4 font-bold text-[#0A0A0B] transition-all hover:brightness-110"
              >
                <Download className="h-5 w-5" aria-hidden />
                Install CLI
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 rounded-lg border border-[#27272A] px-8 py-4 font-bold text-white transition-all hover:bg-[#121214]"
              >
                <PlayCircle className="h-5 w-5" aria-hidden />
                Watch Demo
              </button>
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
                <div className="mx-auto font-mono text-xs uppercase tracking-widest text-zinc-500">zsh — socrates</div>
              </div>
              <div className="min-h-[400px] p-6 font-mono text-sm leading-relaxed">
                <div className="flex gap-2">
                  <span className="text-[#22C55E]">➜</span>
                  <span className="text-white">socrates init project-alpha</span>
                </div>
                <div className="mt-2 italic text-zinc-500">Analyzing architecture...</div>
                <div className="mt-4 text-[#22C55E]">
                  ? Socrates: Before we generate the API, how do you plan to handle state persistence?
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
                  ? Socrates: Excellent. Why Redis over a traditional SQL database for this specific microservice?
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-block h-4 w-2 animate-pulse bg-[#22C55E]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#27272A] bg-[#050505] py-32">
          <div className="mx-auto max-w-[1440px] px-8">
            <div className="max-w-4xl space-y-24">
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
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-8 py-32">
          <div className="mb-16 space-y-4 text-center">
            <h2 className="text-4xl font-bold text-white">
              The Socratic Dialogue for <span className="text-[#22C55E]">Devs</span>
            </h2>
            <p className="mx-auto max-w-xl text-zinc-400">
              Socrates AI interrogates your intent before generating a single line of code.
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
                  High friction, deep thinking. Socrates will refuse to generate code until you successfully explain the
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

        <section className="mx-auto max-w-[1440px] px-8 py-32">
          <div className="grid gap-16 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-4">
              <h2 className="text-4xl font-bold leading-tight text-white">The Learning Trail</h2>
              <p className="leading-relaxed text-zinc-400">
                Every session generates a live README.md that documents your learning progress, decisions made, and
                technical debt acknowledged. It&apos;s your project&apos;s soul.
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
              <div className="overflow-hidden rounded-xl border border-[#27272A] bg-[#121214]">
                <div className="flex items-center justify-between border-b border-[#27272A] bg-[#18181B] px-6 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-zinc-500" aria-hidden />
                    <span className="font-mono text-xs uppercase tracking-widest text-white">
                      Socrates_Learning_Trail.md
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
                    <div className="h-2 w-2 rounded-full bg-[#22C55E]/30" />
                    <div className="h-2 w-2 rounded-full bg-[#22C55E]/30" />
                  </div>
                </div>
                <div className="max-h-[500px] space-y-6 overflow-y-auto p-8 font-sans text-zinc-400">
                  <h1 className="border-b border-[#27272A] pb-4 text-2xl font-bold text-white">Project: Auth-Bridge</h1>
                  <p>
                    This document tracks the technical evolution of{" "}
                    <code className="rounded bg-[#18181B] px-1 text-[#22C55E]">Auth-Bridge</code>. Decisions made
                    through Socratic dialogue.
                  </p>
                  <h2 className="mt-8 text-xl font-bold text-white">Decisions &amp; Trade-offs</h2>
                  <div className="rounded border-l-4 border-[#22C55E] bg-[#18181B] p-4">
                    <p className="mb-2 text-sm font-bold text-white">JWT vs Session Cookies</p>
                    <p className="text-sm">
                      Chose JWT because the system needs to be stateless for horizontal scaling. Acknowledged security
                      risk: No easy way to revoke tokens without a blacklist.
                    </p>
                  </div>
                  <h2 className="mt-8 text-xl font-bold text-white">Knowledge Checkpoints</h2>
                  <ul className="list-disc space-y-2 pl-6 text-sm">
                    <li>
                      Explained the difference between <code className="text-zinc-200">symmetric</code> and{" "}
                      <code className="text-zinc-200">asymmetric</code> encryption.
                    </li>
                    <li>
                      Mapped the <code className="text-zinc-200">OIDC</code> handshake flow from scratch.
                    </li>
                    <li>
                      Identified why <code className="text-zinc-200">bcrypt</code> is preferred over{" "}
                      <code className="text-zinc-200">SHA-256</code> for password hashing.
                    </li>
                  </ul>
                  <h2 className="mt-8 text-xl font-bold text-white">Code Reference</h2>
                  <div className="rounded-lg bg-[#050505] p-4 font-mono text-xs">
                    <span className="text-zinc-600">{"// Derived from Dialogue #42"}</span>
                    <br />
                    <span className="text-[#22C55E]">export</span> <span className="text-white">const</span>{" "}
                    <span className="text-[#96d59d]">verifyScope</span> <span className="text-white">=</span>{" "}
                    <span className="text-white">(token) =&gt; {"{"}</span>
                    <br />
                    <span className="text-zinc-500">
                      {"  // Logic for scope verification explained by user in PoU check."}
                    </span>
                    <br />
                    <span className="text-white">{"};"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#050505] py-32">
          <div className="mx-auto max-w-[1440px] px-8">
            <div className="mb-20 text-center">
              <h2 className="text-4xl font-bold text-white">The Socratic Workflow</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: "1", t: "Ask", d: "Input your project requirements through the CLI or Web UI." },
                { n: "2", t: "Think", d: "Socrates challenges your assumptions with clarifying questions." },
                { n: "3", t: "Build", d: "Code is generated once you demonstrate architectural clarity." },
                { n: "4", t: "Export", d: "Receive your source code and the Learning Trail documentation." },
              ].map((step) => (
                <div key={step.n} className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#27272A] bg-[#121214] text-lg font-bold text-[#22C55E]">
                    {step.n}
                  </div>
                  <h4 className="font-bold text-white">{step.t}</h4>
                  <p className="text-sm text-zinc-500">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-32">
          <div className="mx-auto max-w-[1440px] px-8">
            <div className="relative space-y-8 overflow-hidden rounded-2xl bg-[#22C55E] p-12 text-center lg:p-24">
              <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(#000 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />
              <h2 className="relative z-10 text-4xl font-black tracking-tighter text-[#0A0A0B] lg:text-6xl">
                Start building things you actually understand.
              </h2>
              <div className="relative z-10 mx-auto max-w-2xl space-y-6">
                <div className="flex items-center justify-between rounded-xl bg-[#0A0A0B] p-4 font-mono text-lg text-white">
                  <span>$ {CLI}</span>
                  <InlineCopyRow command={CLI} layout="icon" />
                </div>
                <div className="flex flex-col justify-center gap-4 sm:flex-row">
                  <button
                    type="button"
                    className="rounded-lg bg-[#0A0A0B] px-8 py-4 font-bold text-white transition-opacity hover:opacity-90"
                  >
                    Get Started Free
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border-2 border-[#0A0A0B] bg-transparent px-8 py-4 font-bold text-[#0A0A0B] transition-all hover:bg-[#0A0A0B] hover:text-[#22C55E]"
                  >
                    Read the Docs
                  </button>
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
              <div className="font-bold text-white">Socrates AI</div>
            </div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#22C55E]">Built for the terminal.</div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 font-mono text-xs uppercase tracking-widest text-zinc-500">
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href="/documentation">
              Documentation
            </a>
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href="/changelog">
              Changelog
            </a>
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href="/security">
              Security
            </a>
            <a className="cursor-pointer transition-colors hover:text-[#22C55E]" href="/privacy">
              Privacy
            </a>
          </div>
          <div className="text-center font-mono text-xs text-zinc-500 md:text-right">
            © 2026 Socrates AI. Built with ❤️ during the FRICTION Hackathon.
          </div>
        </div>
      </footer>
    </>
  );
}
