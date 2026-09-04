<div align="center">

# ⏱ agentbench

[![Live Dashboard](https://img.shields.io/badge/dashboard-agentbench--live.vercel.app-5eead4?style=for-the-badge&logo=vercel)](https://agentbench-live.vercel.app)
[![Data API](https://img.shields.io/badge/API-summary.json-818cf8?style=for-the-badge&logo=json)](https://agentbench-live.vercel.app/summary.json)
[![CI](https://img.shields.io/github/actions/workflow/status/Shafwansafi06/agentbench/benchmark.yml?style=for-the-badge&label=benchmark%20CI&branch=main)](https://github.com/Shafwansafi06/agentbench/actions/workflows/benchmark.yml)
[![Last Commit (data)](https://img.shields.io/github/last-commit/Shafwansafi06/agentbench/main?label=last%20data%20run&style=for-the-badge&color=teal)](https://github.com/Shafwansafi06/agentbench/commits/main/)

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub Actions](https://img.shields.io/badge/cron-every%206h-2088FF?style=flat-square&logo=githubactions&logoColor=white)](.github/workflows/benchmark.yml)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4?style=flat-square)](CONTRIBUTING.md)
[![providers](https://img.shields.io/badge/browser%20providers-6-5eead4?style=flat-square)](#providers)
[![sandboxes](https://img.shields.io/badge/sandbox%20providers-3-e879f9?style=flat-square)](#providers)

</div>

> The first continuously-running, reproducible benchmark for cloud browser and
> sandbox providers serving **AI agents**.

**Vendor benchmarks are marketing.** Self-run, happy-path, stale the day they're
posted. This one runs on a schedule, in public, with the code and raw data open —
so anyone can clone the repo and recompute every number.

| | |
|---|---|
| 🔴 **Live dashboard** | https://agentbench-live.vercel.app |
| 🔌 **Data API** | https://agentbench-live.vercel.app/summary.json |
| 📦 **Raw data** | `data/runs/` — append-only JSONL, committed by CI every 6h |
| 📐 **Methodology** | pre-registered 2026-09-02 → [METHODOLOGY.md](METHODOLOGY.md) |
| 🤝 **Add a provider** | < 30 min → [CONTRIBUTING.md](CONTRIBUTING.md) |

---

## How it works

```mermaid
flowchart LR
    subgraph CI["⏰ GitHub Actions · 6h cron"]
        A[benchmark workflow] --> B[interleaved runner]
        B --> C[latency suite<br/>6 browser providers]
        B --> D[stealth gauntlet<br/>7 fingerprint checks]
        B --> E[sandbox suite<br/>3 sandbox providers]
    end

    C --> J[(data/runs/*.jsonl<br/>raw ns timestamps<br/>append-only)]
    D --> J
    E --> J
    J --> S[summarize.ts<br/>p50 / p95 / p99<br/>bootstrap 95% CI]
    S --> D2[(data/summary.json)]
    D2 --> V[🎮 Vercel dashboard<br/>React + GSAP]
    D2 --> API[🔌 /summary.json<br/>public data API]

    style CI fill:#0a0d14,stroke:#5eead4,color:#e7ecf3
    style J fill:#11151f,stroke:#818cf8,color:#e7ecf3
    style V fill:#11151f,stroke:#e879f9,color:#e7ecf3
```

**The measurement cycle** — every provider runs the exact same lifecycle, in
interleaved (round-robin) order:

```mermaid
sequenceDiagram
    participant H as harness
    participant P as provider SDK
    participant B as provider's browser

    H->>P: ① session_create (REST / SDK)
    P-->>H: session ready
    H->>B: ② cdp_connect + newPage
    H->>B: ③ goto(control page)
    Note over B: PerformanceNavigationTiming captured<br/>INSIDE provider's browser:<br/>dns · tcp · tls · ttfb · dcl
    H->>P: ④ teardown / release

    Note over H,P: raw hrtime ns offsets per phase<br/>→ one JSONL row per cycle
```

Key isolation trick: the control page is a version-pinned ~80 KiB page we
self-host on [Vercel](https://control-page-live.vercel.app) — never
`example.com` — and network timings are read from **inside the provider's own
browser**, so CDN noise and harness network are separated from provider
overhead.

## Providers

| Primitive | Providers | Status |
|---|---|---|
| 🌐 Browser | Solari · Browserbase · Steel · Kernel · Hyperbrowser · Anchor | 6 adapters |
| 📦 Sandbox | Solari · E2B · Daytona | 3 adapters |
| 🖥 Desktop | — | roadmap (Modal listed *not measured* — no Node SDK) |

Every adapter implements one tiny interface and is one line in the registry.
A missing provider is never silently skipped — it's listed in results as
**"not measured — no access."**

## Quickstart

```bash
git clone https://github.com/Shafwansafi06/agentbench
cd agentbench
npm install
cp .env.example .env        # add the API keys you have
npm run providers           # which providers are configured?
npm run bench -- --providers solari,kernel --n 20
```

```bash
# other primitives:
npm run bench -- --primitive sandbox --providers solari,e2b,daytona --n 10
npm run bench -- stealth --providers solari,kernel --n 10   # fingerprint gauntlet
npm run bench -- --providers solari --sustained 100         # p95-degradation loop
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
  that beat the favorites get the same treatment. No cherry-picking.
- **Honest about fused phases.** Where an SDK fuses create+connect
  (Solari's `launch()`), the data marks it `fused` instead of letting the
  span masquerade as a split measurement.
- **Extensible.** A provider is one small interface
  (`BrowserProviderAdapter`) plus one line in the registry.

## Why trust these numbers

See [METHODOLOGY.md](METHODOLOGY.md) for the full pre-registered protocol.

- **Interleaved** — providers round-robined within every cycle
- **Raw data committed** — ns timestamps, harness git hash, SDK versions per row
- **Failures published** — error strings in the data, nothing filtered
- **Pre-registered** — methodology dated 2026-09-02, changes only as new dated entries
- **Deterministic stats** — fixed-seed bootstrap, anyone can recompute from JSONL

## Data pipeline

```mermaid
flowchart TD
    A[one cycle] -->|"JSONL row:<br/>ns phase timestamps +<br/>git hash + SDK versions"| B[data/runs/run-*.jsonl]
    B -->|"url filter<br/>(control-page rows only)"| C[percentiles + bootstrap CIs]
    C --> D[data/summary.json]
    D --> E[dashboard auto-refresh]
    D --> F[badge API]
    B -->|git clone| G[👀 anyone re-analyzes<br/>the full history]
```

## Contributing

Add a provider in under 30 minutes — implement
`BrowserProviderAdapter`/`SandboxProviderAdapter`, one line in the registry,
disclose your SDK version and plan tier. Full rules:
[CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

- [x] 6 browser providers: Solari, Browserbase, Steel, Kernel, Hyperbrowser, Anchor
- [x] 3 sandbox providers: Solari, E2B, Daytona (Modal: no Node SDK — listed as not measured)
- [x] Self-hosted control page (Vercel) + in-page PerformanceNavigationTiming isolation
- [x] Stealth gauntlet: 7 self-contained fingerprint checks
- [x] Sustained agent loop with p95 degradation report
- [x] Dashboard (React + GSAP) + JSON API + scheduled CI runs
- [x] Contributor guide ([CONTRIBUTING.md](CONTRIBUTING.md))
- [x] Verified pricing for 7/9 providers ([data/pricing.json](data/pricing.json))
- [ ] Cost per 1k sessions on the dashboard
- [ ] 3-region matrix (needs paid GH runners — standard runners disclose no region)
- [ ] Third-party gauntlet sites (CreepJS, sannysoft) — flaky, so self-contained checks shipped first
- [ ] npm publish

## License

MIT licensed. Numbers belong to everyone — clone, recompute, cite.

<div align="center">
  <sub>built as a <a href="https://www.linkedin.com/company/getsolari/">Solari</a> build challenge entry — Pinetree Research SWE intern application</sub>
</div>
