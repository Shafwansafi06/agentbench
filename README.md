# agentbench

> The first continuously-running, reproducible benchmark for cloud browser and
> sandbox providers serving AI agents.

Vendor benchmarks are marketing. This one runs on a schedule, in public, from
multiple regions, with the code and the raw data open.

**Status: under active construction.** METHODOLOGY.md is a DRAFT — nothing
here is citable until it is finalized and dated there.

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

- [ ] Self-hosted control page + network-vs-provider isolation (day 3)
- [ ] Sandbox providers: Solari, E2B, Daytona, Modal (day 3)
- [ ] 3-region GitHub Actions matrix, 6h cron (day 4)
- [ ] Pricing model + cost per 1k sessions (day 4)
- [ ] Public dashboard (day 5)
- [ ] Stealth gauntlet + sustained agent loop (day 3+)
- [ ] npm publish + contributor guide (day 6)

MIT licensed.
