# OUTREACH.md — provider pre-notification

**Rule (from METHODOLOGY.md, rule 3):** providers are notified and given a chance to
comment before publication. These emails go out BEFORE the LAUNCH.md posts.

**Protocol:**

1. Send emails first. Wait 24h; if no reply, send the DM version.
2. All publication dates are `{{PUBLICATION_DATE}}` — fill before sending.
3. If a provider flags a config error, fix it, rerun, and note the correction in the launch post. Never quietly patch a number.
4. If a provider sends a comment, publish it verbatim alongside the data (as a linked issue or quoted in launch materials). Their say gets equal placement, not a footnote.
5. Numbers quoted here are the current preliminary run. Re-check against `data/summary.json` before sending.

**Where their numbers live (cite this in every email):**

- `data/runs/*.jsonl` — every cycle, raw nanosecond phase timestamps, append-only
- `data/summary.json` — recomputed p50/p95/p99 aggregates with bootstrap 95% CIs

---

## Emails

### 1. Solari — special version (to Harry Chow / hiring-party team)

**Subject:** agentbench — independent benchmark; your numbers before I publish

Hi Harry,

I built an independent benchmark for AI-agent cloud browser and sandbox providers — continuously-running, reproducible, raw data committed publicly: https://github.com/Shafwansafi06/agentbench. Solari is in it, and I want you to see your numbers before I publish on {{PUBLICATION_DATE}}.

What your stack did well in my current data: fastest first_navigation of any provider measured (328ms p50), best DOM-content-loaded (35.7ms), and a competitive full round trip (4.1s p50, slightly ahead of Kernel's 4.2s).

Two findings I want you to see first, stated plainly:

1. Solari's advertised 199ms session-create matches the raw API. The SDK-ready session (`launch()`) measures ~2.7s p50, because create and connect are fused in the SDK — not separately observable. My data marks this phase `fused`; it's never presented as a split.
2. On my 7-check stealth gauntlet, Solari passes 3/7 (43%) — the headless image fails plugins, chrome-object, and WebGL-GPU. Kernel passes 6/7 running headful, which is the clearest confound. If Solari has a headful or plugin-capable config, I'd genuinely like to test it.

Everything is in `data/runs/*.jsonl` (per-cycle raw timestamps) and `data/summary.json` (aggregates). If anything on my end is misconfigured, tell me and I'll fix and rerun before publication — and your response gets published alongside the numbers, verbatim.

— Shafwan

### 2. Browserbase

**Subject:** agentbench — independent AI-agent browser benchmark; your results before I publish

Hi team,

I built an independent benchmark for cloud browser and sandbox providers serving AI agents — it runs on a schedule, in public, with raw data committed: https://github.com/Shafwansafi06/agentbench. Browserbase is supported in the harness and your results are still accumulating; I wanted you to see them before publication on {{PUBLICATION_DATE}}.

Each cycle is a JSONL row with raw nanosecond phase timestamps in `data/runs/*.jsonl`, and recomputed p50/p95/p99 aggregates with bootstrap 95% CIs live in `data/summary.json`. Providers are round-robined within every cycle so sequential network drift can't bias a run, warmups are disclosed, and failures are published rather than filtered.

My question for you: anything misconfigured on my end — adapter choice, region, session flags, plan tier? If so, point me at it and I'll fix and rerun before publishing. Your comment gets posted alongside the numbers, verbatim, if you want one.

— Shafwan

### 3. Steel

**Subject:** agentbench — independent AI-agent browser benchmark; your numbers before I publish

Hi team,

I built an independent, continuously-running benchmark for AI-agent browser providers — raw data committed, reproducible: https://github.com/Shafwansafi06/agentbench. Steel is one of the six providers measured, and here are your current numbers before I publish on {{PUBLICATION_DATE}}.

Full round trip p50: ~5.7s, currently the slowest of the four providers with enough samples (Solari 4.1s, Kernel 4.2s, Hyperbrowser 4.6s). Two possible contributors visible in the phase data: session_create has a long tail (p95 ~2.9s) and first-navigation DNS was ~93ms in my runs, which may just be region placement. Stealth gauntlet: 4/7 (57%) — the plugins fingerprint check fails, consistent with a headless image; Kernel passes 6/7 running headful.

Per-cycle raw timestamps are in `data/runs/*.jsonl`; aggregates with CIs are in `data/summary.json`. These are small-N preliminary runs. If any of this looks like a misconfiguration on my end — adapter, region, proxy settings — tell me and I'll fix and rerun before publishing. Your response gets posted verbatim alongside the data if you want.

— Shafwan

### 4. Kernel

**Subject:** agentbench — independent AI-agent browser benchmark; your numbers before I publish

Hi team,

I built an independent, continuously-running benchmark for AI-agent browser providers — code and raw data public, runs on a schedule: https://github.com/Shafwansafi06/agentbench. Kernel is one of the six providers measured, and here are your current numbers before I publish on {{PUBLICATION_DATE}}.

Where you lead: best stealth pass rate — 6/7 (86%) on a 7-check fingerprint gauntlet, helped by your headful image where others run headless and fail the plugins/chrome-object/WebGL-GPU checks. Session_create, measured with phases split, is 278ms p50. Full round trip p50 is 4.2s, within ~150ms of the current leader.

Per-cycle raw timestamps are in `data/runs/*.jsonl`; recomputed p50/p95/p99 aggregates with bootstrap 95% CIs are in `data/summary.json`. Sample counts are still small and growing every run. If anything looks misconfigured on my end — adapter flags, region, headless/headful parity — tell me and I'll fix and rerun before publishing. Your comment gets posted verbatim alongside the numbers if you want one.

— Shafwan

### 5. Hyperbrowser

**Subject:** agentbench — independent AI-agent browser benchmark; your numbers before I publish

Hi team,

I built an independent, continuously-running benchmark for AI-agent browser providers — raw data committed, reproducible, public: https://github.com/Shafwansafi06/agentbench. Hyperbrowser is one of the six providers measured, and here are your current numbers before I publish on {{PUBLICATION_DATE}}.

Full round trip p50: ~4.6s (Solari 4.1s, Kernel 4.2s, Steel 5.7s for comparison). Your session_create is among the fastest measured; most of your remaining time sits in CDP connect. Stealth gauntlet: 5/7 (71%) — the permissions and WebGL-GPU checks fail in my runs.

Per-cycle raw timestamps are in `data/runs/*.jsonl`; recomputed p50/p95/p99 aggregates with bootstrap 95% CIs are in `data/summary.json`. These are small-N preliminary runs that keep growing. If any of this looks like a misconfiguration on my end — adapter choice, region, session flags — tell me and I'll fix and rerun before publication. Your comment gets posted verbatim alongside the data if you'd like.

— Shafwan

### 6. Anchor

**Subject:** agentbench — independent AI-agent browser benchmark; your results before I publish

Hi team,

I built an independent benchmark for cloud browser providers serving AI agents — continuously-running, reproducible, with raw data committed publicly: https://github.com/Shafwansafi06/agentbench. Anchor is supported in the harness; your results are still accumulating and I wanted you to see them before publication on {{PUBLICATION_DATE}}.

Once enough cycles land, your numbers will be visible in `data/summary.json` (recomputed p50/p95/p99 with bootstrap 95% CIs) and as per-cycle raw nanosecond timestamps in `data/runs/*.jsonl`. Design points worth knowing: providers are round-robined within every cycle so time-of-day drift can't bias a run, warmups are disclosed, and failures are published rather than filtered — the same treatment every provider gets, including the ones with unflattering numbers.

My question: anything misconfigured on my end — adapter, region, session flags? Point me at it and I'll fix and rerun before publishing. Your comment gets posted alongside the numbers, verbatim, if you want one.

— Shafwan

### 7. E2B

**Subject:** agentbench — independent AI-agent sandbox benchmark; your results before I publish

Hi team,

I built an independent benchmark for cloud sandbox and browser providers serving AI agents — continuously-running, reproducible, raw data committed publicly: https://github.com/Shafwansafi06/agentbench. E2B is supported in the sandbox suite; your results are still accumulating and I wanted you to see them before publication on {{PUBLICATION_DATE}}.

The sandbox suite measures create, first exec, exec overhead, a 1MB filesystem write, and teardown, with raw nanosecond phase timestamps per cycle in `data/runs/*.jsonl` and recomputed p50/p95/p99 aggregates with bootstrap 95% CIs in `data/summary.json`. Providers are round-robined within each cycle, warmups are disclosed, and failures are published rather than filtered — the same treatment every provider gets.

For context, the only sandbox with enough samples so far posts ~6.3s p50 on the 1MB write. My question for you: anything misconfigured on my end — template choice, region, SDK version? Point me at it and I'll fix and rerun before publishing. Your comment gets posted alongside the numbers, verbatim, if you want one.

— Shafwan

### 8. Daytona

**Subject:** agentbench — independent AI-agent sandbox benchmark; your results before I publish

Hi team,

I built an independent benchmark for cloud sandbox and browser providers serving AI agents — continuously-running, reproducible, with raw data committed publicly: https://github.com/Shafwansafi06/agentbench. Daytona is supported in the sandbox suite; your results are still accumulating and I wanted you to see them before publication on {{PUBLICATION_DATE}}.

The suite measures create, first exec, exec overhead, a 1MB filesystem write, and teardown. Every cycle is a JSONL row with raw nanosecond phase timestamps in `data/runs/*.jsonl`; aggregates (p50/p95/p99 with bootstrap 95% CIs) live in `data/summary.json` and are recomputed from raw data, never pre-aggregated. Providers are round-robined within every cycle, warmups are disclosed, and failures are published rather than filtered — identical treatment for every provider, favorable or not.

My question: anything misconfigured on my end — image choice, region, SDK usage? Point me at it and I'll fix and rerun before publishing. Your comment gets posted alongside the numbers, verbatim, if you want one.

— Shafwan

---

## DM versions (X/Twitter)

### Solari — special version (DM to Harry Chow)

Hi Harry — I built an independent, continuously-running benchmark for AI-agent browser providers: https://github.com/Shafwansafi06/agentbench. Solari's numbers run both ways in my data: fastest first_navigation measured (328ms p50), best DCL (35.7ms), but the SDK-ready session is ~2.7s because `launch()` fuses create+connect (marked `fused` in the data, never shown as a split), and 3/7 on my stealth gauntlet where your headless image fails plugins/chrome-object/WebGL-GPU. Publishing {{PUBLICATION_DATE}}. Anything misconfigured on my end — especially a headful config worth testing? Happy to rerun and include your comment verbatim.

### Browserbase

Hi — I built an independent, continuously-running benchmark for AI-agent browser providers: https://github.com/Shafwansafi06/agentbench. Browserbase is supported in the harness; your results are still accumulating. Per-cycle raw timestamps in data/runs/*.jsonl, aggregates in summary.json. Publishing {{PUBLICATION_DATE}} — anything misconfigured on my end (region, adapter, flags)? Happy to fix and rerun, and post your comment alongside the numbers.

### Steel

Hi — I built an independent, continuously-running benchmark for AI-agent browser providers: https://github.com/Shafwansafi06/agentbench. Your current numbers: ~5.7s p50 full round trip, 4/7 stealth (plugins check fails on headless), session_create p95 tail ~2.9s, ~93ms DNS on first nav. Small N, growing. Publishing {{PUBLICATION_DATE}} — anything misconfigured on my end? Raw data is in the repo; your comment gets posted verbatim with the data.

### Kernel

Hi — I built an independent, continuously-running benchmark for AI-agent browser providers: https://github.com/Shafwansafi06/agentbench. Your numbers so far: best stealth (6/7, headful helps), 278ms p50 split-measured session_create, 4.2s p50 full round trip. Small N, growing. Publishing {{PUBLICATION_DATE}} — anything misconfigured on my end (adapter, region, flags)? Raw data is in the repo; your comment gets posted verbatim with the numbers.

### Hyperbrowser

Hi — I built an independent, continuously-running benchmark for AI-agent browser providers: https://github.com/Shafwansafi06/agentbench. Your current numbers: ~4.6s p50 full round trip (most of it in CDP connect), 5/7 stealth (permissions + WebGL-GPU fail). Small N, growing. Publishing {{PUBLICATION_DATE}} — anything misconfigured on my end? Raw data is in the repo; your comment gets posted verbatim with the numbers.

### Anchor

Hi — I built an independent, continuously-running benchmark for AI-agent browser providers: https://github.com/Shafwansafi06/agentbench. Anchor is supported in the harness; results still accumulating. Raw per-cycle timestamps + recomputed aggregates, all committed. Publishing {{PUBLICATION_DATE}} — anything misconfigured on my end (region, adapter, flags)? Happy to fix and rerun, and post your comment alongside the numbers.

### E2B

Hi — I built an independent, continuously-running benchmark for AI-agent sandbox/browser providers: https://github.com/Shafwansafi06/agentbench. E2B is in the sandbox suite (create, first exec, exec overhead, 1MB write, teardown); results still accumulating. Raw data committed, aggregates recomputed with CIs. Publishing {{PUBLICATION_DATE}} — anything misconfigured on my end (template, region, SDK)? Happy to fix and rerun, and post your comment alongside the numbers.

### Daytona

Hi — I built an independent, continuously-running benchmark for AI-agent sandbox/browser providers: https://github.com/Shafwansafi06/agentbench. Daytona is in the sandbox suite; results still accumulating. Raw per-cycle timestamps in data/runs/*.jsonl, recomputed p50/p95/p99 with CIs in summary.json. Publishing {{PUBLICATION_DATE}} — anything misconfigured on my end (image, region, SDK usage)? Happy to fix and rerun, and post your comment alongside the numbers.

---

## Send checklist

- [ ] Fill `{{PUBLICATION_DATE}}` in all emails and DMs.
- [ ] Solari email goes to Harry Chow personally, not a support inbox.
- [ ] Re-check all quoted numbers against `data/summary.json` on send day.
- [ ] Log send times and any replies here; publish replies verbatim with the launch data.
