# LAUNCH.md — agentbench launch package

**Pre-flight before posting:**

- [ ] Re-verify every number below against the latest `data/summary.json` (numbers are preliminary; N grows before launch).
- [ ] Confirm dashboard URL is current: https://agentbench-live.vercel.app
- [ ] On LinkedIn/X, replace plain-text names "Harry Chow" and "Solari" with the actual taggable accounts while composing.
- [ ] Send OUTREACH.md emails BEFORE this goes public (methodology rule 3).
- [ ] Insert real star/cycle counts in the week-1 follow-up.

**Primary post character count: under 3000 (verified).**

---

## 1. Primary LinkedIn/X post

A provider advertises 199ms session-create. The raw API hits that number. The SDK-ready session your agent actually gets — the one where create and connect are fused inside their SDK — measures 523ms from a US datacenter and ~2.7s from South Asia on the same harness. Kernel's split-measured session_create: 116ms (US). Neither number is wrong. But if you're paying for browser sessions for AI agents, you should know which one you're buying — and from where you're buying.

That's why I built agentbench: a continuously-running, reproducible benchmark for cloud browser and sandbox providers serving AI agents. Vendor benchmarks are marketing — self-run, happy-path, stale the day they're posted. As far as I can tell, nobody runs this comparison on a schedule, in public, with raw data anyone can audit. A one-off benchmark can't be rechecked. This one can.

Repo: https://github.com/Shafwansafi06/agentbench
Live dashboard: https://agentbench-live.vercel.app

Early numbers — small N, preliminary, growing (raw data committed to the repo):

• Full round trip p50 from GitHub US runners: Kernel 0.83s · Solari 0.92s · Hyperbrowser 1.5s · Steel 2.0s. The same harness run from South Asia measured every provider 3–5x slower — where your runner lives matters as much as who your vendor is.
• Stealth gauntlet (7 self-contained fingerprint checks): Kernel 86% · Hyperbrowser 71% · Steel 57% · Solari 43%. Solari's headless image fails the plugins, chrome-object, and WebGL-GPU checks; Kernel runs headful. Fingerprintability is an agent-reliability cost, not just a privacy one.
• Same harness, two networks: Solari sandbox 1MB file write p50 was ~6.3s from South Asia, 516ms from a US runner.

Methodology, so you can check the work: providers are round-robined within every cycle (kills time-of-day bias), warmups are disclosed, every phase boundary is stored as a raw nanosecond timestamp in JSONL, and metrics are recomputed — never pre-aggregated — as p50/p95/p99 with bootstrap 95% CIs. Fused phases are marked fused in the data, never presented as splits. Think I misconfigured a provider? Open an issue and I'll rerun it.

Tagging Solari and Harry Chow because their product is what I had in the browser tab when this started. Their numbers run in both directions in my data — fastest first_navigation in the current run (99ms p50), best full round trip of any headless image — plus the fused-phase gap above. Everything is in the repo, raw. This is an independent measurement, not a pitch: numbers up, numbers down, all published.

---

## 2. Alternate first-line hooks

**Hook A (stealth angle):**

> Kernel passes 6 of 7 browser fingerprint checks. Solari passes 3. The gap is headful vs headless — and it's an agent-reliability cost, not a privacy footnote.

**Hook B (benchmark-staleness angle):**

> Every AI-agent browser benchmark you've seen is a marketing artifact: self-run, happy-path, frozen in time. This one runs every 6 hours, in public, with raw data committed.

Swap in for paragraph one; the rest of the post works unchanged after either.

---

## 3. Show HN

**Title:**

Show HN: Agentbench – a continuously-running, reproducible benchmark for AI-agent browser and sandbox providers

**Body (post as first comment):**

Agents burn most of their latency budget on things nobody benchmarks: session creation, CDP attach, first navigation, teardown. Each provider publishes its own numbers, on its own happy path, once — and those numbers can't be rerun or audited. Agentbench runs the same harness against six browser providers (Solari, Browserbase, Steel, Kernel, Hyperbrowser, Anchor) and three sandbox providers (Solari, E2B, Daytona; Modal has no Node SDK, listed as not measured) on a schedule, and commits everything: raw nanosecond phase timestamps per cycle in JSONL, recomputed p50/p95/p99 with bootstrap 95% CIs, warmups disclosed, providers round-robined within every cycle so time-of-day can't bias a run. Where a SDK fuses phases (Solari's `launch()` fuses create+connect), the data says so explicitly instead of letting the fused span masquerade as a split. There's also a stealth gauntlet — seven self-contained fingerprint checks — because a fingerprintable browser is an agent-reliability problem, not just a privacy one.

Current numbers are preliminary and small-N (they grow every scheduled run), but the shape is already interesting: full round trip p50 Solari 4.1s, Kernel 4.2s, Hyperbrowser 4.6s, Steel 5.7s; stealth pass rates Kernel 86%, Hyperbrowser 71%, Steel 57%, Solari 43% (headless image fails plugins/chrome-object/WebGL-GPU; Kernel is headful). Solari's marketed "199ms session create" is a raw-API figure; the SDK-ready session measures ~2.7s. Repo: https://github.com/Shafwansafi06/agentbench — dashboard: https://agentbench-live.vercel.app — you can rerun any of it with `npm run bench`. Providers are notified before publication and get their say; if you think I misconfigured one, open an issue and I'll rerun. Roadmap: 3-region matrix, cost per 1k sessions, third-party gauntlet sites (CreepJS, sannysoft) once they stop being flaky. What would you measure that I'm not?

---

## 4. Reddit post (r/LocalLLaMA or r/programming)

**Title:**

I built a continuously-running public benchmark for cloud browser/sandbox providers that AI agents depend on — raw data committed, runs every 6 hours

**Body:**

Most latency conversations about agents stop at the model. In practice, a large part of an agent's wall-clock is the cloud browser or sandbox it lives in: session create, CDP connect, first navigation, teardown, file I/O. Every provider publishes its own numbers for that — self-run, happy-path, one snapshot — and nobody can rerun them to check.

So I built agentbench: a harness that runs the same measurement against six browser providers (Solari, Browserbase, Steel, Kernel, Hyperbrowser, Anchor) and three sandboxes (Solari, E2B, Daytona — Modal listed as not measured, no Node SDK), on a schedule, with everything committed to the repo:

- Every cycle is a JSONL row with raw nanosecond phase timestamps. Metrics are recomputed, never stored pre-aggregated.
- Providers are round-robined within each cycle, so sequential network drift can't favor whoever went last.
- Warmups are disclosed. Failures and outliers are published, not filtered.
- p50/p95/p99 with bootstrap 95% CIs.
- Where an SDK fuses phases (Solari's `launch()` fuses session create + CDP connect), the data marks it fused instead of letting it pass as a split measurement.
- A stealth gauntlet of 7 self-contained fingerprint checks — a fingerprintable browser gets your agent blocked mid-task, so this is reliability, not just privacy.

Repo: https://github.com/Shafwansafi06/agentbench
Dashboard (updates from scheduled runs): https://agentbench-live.vercel.app

Early results, preliminary and small-N (N grows each run):

- Full round trip p50: Solari 4.1s, Kernel 4.2s, Hyperbrowser 4.6s, Steel 5.7s
- Stealth: Kernel 86%, Hyperbrowser 71%, Steel 57%, Solari 43% — Solari's headless image fails plugins/chrome-object/WebGL-GPU; Kernel runs headful
- Solari's advertised "199ms session create" is a raw-API number; the SDK-ready session measures ~2.7s (fused create+connect)
- Solari sandbox 1MB write: p50 ~6.3s

Honest findings run in both directions — Solari also posts the fastest first_navigation in my data (328ms p50) and the best DOM-content-loaded time (35.7ms).

Questions for this community: does anything like this already exist that I should be comparing against? What would you add to the gauntlet? Next on the roadmap are a 3-region matrix (needs paid runners), cost-per-1k-sessions from verified pricing, and third-party fingerprint sites (CreepJS, sannysoft) once they stop being flaky. Rerun it yourself with `npm run bench`; a provider is one adapter class + one registry line if you want to add one.

---

## 5. Week-1 follow-up post

**Angle:** "one week of continuous runs" — what the extra data changed, what the community found, what broke.

**Draft skeleton (fill brackets at publish time):**

One week ago I posted agentbench — a continuously-running benchmark for cloud browser/sandbox providers serving AI agents. Since then it has completed [N] cycles across [M] scheduled runs, all committed raw ([link to runs directory]). A few things the extra data changed or confirmed:

1. [Finding that survived with more N — e.g. "the Solari fused-session gap held: ~2.7s SDK-ready vs the 199ms raw-API figure, across [N] cycles."]
2. [Finding that moved — e.g. "Steel's p95 teardown tail shrank after they [flagged X / config change]. This is why continuous beats one-off: a snapshot would have frozen the bad number."]
3. [New finding nobody expected — stealth or sandbox.]

Community side: [X] GitHub stars, [Y] issues/PRs, [Z] of them from providers correcting my configs — including [specific example]. That's the point: when the data is public and raw, being wrong is cheap and fast to fix. [Link a good issue thread.]

Dashboard: [URL] · Repo: https://github.com/Shafwansafi06/agentbench

Next: 3-region matrix, verified cost-per-1k-sessions. If your stack runs on one of these providers, tell me which metric you actually care about and I'll prioritize it.

**Fallback if nothing moved:** lead with "the numbers held" — stability over [N] cycles is itself a finding, and it's the honest one.
