# agentbench

> The first continuously-running, reproducible benchmark for cloud browser and
> sandbox providers serving AI agents.

Vendor benchmarks are marketing. This one runs on a schedule, in public, with
the code and the raw data open.

- **Live dashboard:** https://agentbench-kuo0429h2-on-chaineds-projects.vercel.app
- **Data API:** https://agentbench-kuo0429h2-on-chaineds-projects.vercel.app/summary.json

**Status: under active construction.** METHODOLOGY.md is a DRAFT — numbers are
preliminary until it is finalized and dated there.

## Quickstart

```bash
npm install
cp .env.example .env        # add SOLARI_API_KEY / BROWSERBASE_* keys
npm run providers           # which providers are configured?
npm run bench -- --providers solari,browserbase --n 20
```

Output: a latency table (p50/p95/p99 with bootstrap 95% CIs), per-phase
breakdown, and an append-only JSONL of every cycle in `data/runs/` — raw
nanosecond phase timestamps, committed to the repo.

## Design principles

- **Interleaved execution.** Providers are round-robined within every cycle.
  Sequential execution lets network conditions and time-of-day bias results —
  the mistake most vendor benchmarks make.
- **Raw data or it didn't happen.** Every phase boundary is stored as a raw
  timestamp. Metrics are recomputed, never pre-aggregated.
- **Publish whatever the numbers say.** Failures, outliers, and providers
  that beat Solari get the same treatment as Solari. No cherry-picking.
- **Extensible.** A provider is one small interface
  (`BrowserProviderAdapter`) plus one line in the registry.

## Roadmap

- [x] 6 browser providers: Solari, Browserbase, Steel, Kernel, Hyperbrowser, Anchor
- [x] 3 sandbox providers: Solari, E2B, Daytona (Modal: no Node SDK — listed as not measured)
- [x] Self-hosted control page (Vercel) + in-page PerformanceNavigationTiming isolation
- [x] Stealth gauntlet: 7 self-contained fingerprint checks
- [x] Sustained agent loop with p95 degradation report
- [x] Dashboard + JSON API + scheduled CI runs
- [ ] 3-region matrix (needs paid GH runners — standard runners disclose no region)
- [ ] Pricing verification + cost per 1k sessions
- [ ] Third-party gauntlet sites (CreepJS, sannysoft) — flaky, so self-contained checks ship first
- [ ] npm publish + contributor guide

MIT licensed.
