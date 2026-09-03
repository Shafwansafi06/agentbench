# METHODOLOGY

**Finalized: 2026-09-02.** This document was committed to git (initial commit
of this file, `46b2d4b`, 2026-09-02) before any run data was committed to
`data/runs/` and before any run using the finalized control page was made.
The pre-registration rule: **any future change to this methodology must be a
new dated entry in the [Changelog](#changelog) section at the bottom of this
file.** Existing entries are never edited or deleted.

## What the harness does

### Execution model

- Cycles are **interleaved**: one outer loop over iterations, one inner loop
  over providers, so every iteration runs one cycle for every provider
  (round-robin). Providers are sorted by name first so ordering is
  deterministic. Sequential execution (all of A, then all of B) is
  deliberately avoided — it lets network conditions and time-of-day bias
  results.
- **Warmups are interleaved too** and stored in the data with
  `warmup: true`. Nothing is discarded silently. Warmup rows are excluded
  from percentile aggregation but remain in the committed JSONL.
- Failures are published: a failed cycle still produces a JSONL row with the
  error string in `error`. No cycle is ever filtered out of the raw data.
  `success_rate` counts failures in the denominator (ok / total measured
  cycles); latency percentiles exclude failed cycles only because they have
  no completed timing.

### Timing and storage

- Every phase boundary is measured with `process.hrtime.bigint()` (single
  monotonic clock per cycle) and stored as **raw nanosecond offsets from
  cycle start** (`t0`, `t1` per phase). Durations are derived at analysis
  time; raw offsets are never replaced with pre-aggregated numbers.
- One **append-only JSONL row per cycle**, written to
  `data/runs/run-<runid>.jsonl` (`run-sandbox-*`, `run-stealth-*` variants).
  `schema_version` is `1`.
- Every row carries: `schema_version`, `run_id`, `provider`, `primitive`,
  `iteration`, `warmup`, `region`, `timestamp`, `url`, `harness`
  (`node_version`, `bench_version`, `git_hash` of the harness at run time),
  `provider_meta` (sdk name, `sdk_version`, `plan_tier`), `phases`,
  `fused_phases`, optional `nav_breakdown_ms`, optional `error`, `success`,
  optional `full_round_trip_ns`.
- `full_round_trip_ns` is a composite: earliest phase `t0` → end of
  `teardown`. It is derived, the phase spans are the source of truth.

### Analysis

- Percentiles use **linear interpolation between closest ranks** on sorted
  samples (`percentile()` in `packages/core/src/stats.ts`).
- **Bootstrap 95% CIs** via a deterministic, fixed-seed PRNG (mulberry32,
  seed derived from the sample itself, so identical samples produce
  identical CIs). **2000 resamples** by default; the published summary
  (`data/summary.json`, produced by `scripts/summarize.ts`) uses **1000**
  resamples. Summary reports `p50/p95/p99` of full round trip with a CI on
  p95, plus per-phase `p50/p95`.

### Browser phases

Per cycle (`BROWSER_PHASES` in `packages/core/src/types.ts`):

- `session_create` — API call → session ready.
- `cdp_connect` — CDP attach **and page acquisition**. For SDKs that fuse
  session creation and connection into one call — Solari's `launch()` does —
  the two boundaries are not separately observable. Solari records
  `cdp_connect` in `fused_phases`, and the recorded `cdp_connect` span covers
  page acquisition (`newPage`) only, the same surface other adapters measure
  (`connectOverCDP` + `newPage`). Fused spans must never be interpreted as a
  split of create vs connect.
- `first_navigation` — page acquired → `domcontentloaded` on the control
  page (`goto` with `waitUntil: "domcontentloaded"`, 30 s timeout).
- `teardown` — release session / close browser.
- `full_round_trip` — composite of all of the above (derived, see above).

`first_navigation` targets a **fixed deterministic ~80 KiB control page**
(version `v1`, seeded generator), self-hosted on Vercel
(`control-page/`), so every provider navigates the same bytes on the same
origin. The harness never points published latency numbers at example.com or
any third-party site.

`nav_breakdown_ms` — when the navigation completes, the harness reads the
**PerformanceNavigationTiming entry from inside the provider's own browser**:
`dns`, `tcp`, `tls`, `ttfb`, `content`, `dom_content_loaded` (ms). This
isolates the provider's network path from the harness machine's network:
those numbers traveled the provider's pipe, not ours.

### Stealth gauntlet

Seven **self-contained in-page checks** (defined in
`packages/adapters/browser/src/stealth.ts`, executed inside the provider's
browser via `page.evaluate`). No third-party bot-detection site is used —
public gauntlet sites (CreepJS, sannysoft) change under you and make results
unattributable; they remain roadmap.

1. `webdriver_leak` — `navigator.webdriver` must be false/undefined
2. `languages_present` — `navigator.languages` present and non-empty
3. `plugins_present` — `navigator.plugins` non-empty (headless shells often
   expose 0)
4. `chrome_object` — `window.chrome` defined
5. `permissions_consistent` — notifications permission probe does not
   contradict the UA
6. `webgl_gpu` — WebGL renderer is a real GPU, not SwiftShader/llvmpipe
   software rendering
7. `ua_platform_consistent` — UA and `navigator.platform` agree on OS family

One JSONL row per cycle records per-check booleans plus
`checks_passed`/`checks_total`. Published per-check pass rates are computed
over measured (non-warmup, successful) cycles. Warmup cycles are flagged and
excluded from the rates, not hidden.

### Sandbox phases

Per cycle (`SANDBOX_PHASES` in `packages/core/src/sandbox-types.ts`):

- `create` — sandbox ready
- `first_exec` — first command execution (a 10-iteration shell loop)
- `exec_overhead` — **marginal cost of a second command** in the same
  sandbox — the number that dominates agent loops, since agents exec
  hundreds of times per sandbox
- `filesystem_write_1mb` — 1 MiB write to `/tmp`
- `teardown` — kill the sandbox

Interleaved across providers with the same discipline as the browser
runner, same JSONL schema (`url` is empty for sandboxes — they don't
navigate).

### Sustained agent loop mode

`--sustained N` runs **N sequential cycles against one provider**
(warmup 0) and reports p50/p95 of full round trip for the **first third vs
last third** of measured cycles, plus error counts in each third, and
`degradationP95` = last-third p95 − first-third p95 (positive = the provider
got slower over sustained use — session leaks, rate limits, warm-state
drift). Vendors benchmark one cold start; agents do thousands of cycles.

### Continuous integration

GitHub Actions, `ubuntu-latest`, **6-hour cron** (`17 */6 * * *`), full
suite: interleaved latency (n=50, warmup 3), stealth gauntlet (n=10,
warmup 1), sandbox (n=30, warmup 3). Every scheduled run **commits the raw
JSONL to `data/runs/`** — that commit log is the dataset; anyone can clone
the repo and re-analyze from raw timestamps.

**Region:** every row's `region` field records the runner label. GitHub
standard runners do not expose region selection, so the label is an honest
disclosure, not a guarantee — current scheduled runs record the CLI default
`local`. A regional matrix (us-east/eu-west/ap-south) requires paid larger
runners and is on the roadmap.

## Rules

1. Publish whatever the numbers say, including failures and outliers.
2. Warmups are disclosed and flagged; nothing is discarded silently.
3. Providers are notified and given a chance to comment before publication.
4. No run is excluded after the fact. Outliers are published and discussed.
5. Never navigate providers to example.com or any third-party site for
   published latency numbers.

## Known limitations

- **Plan tiers are undisclosed per provider** until tier disclosure is
  added. `provider_meta.plan_tier` defaults to `undisclosed` unless the
  provider's env var sets it; several providers' plan tiers are currently
  unknown, so cross-provider comparisons may mix free and paid tiers.
- **Pre-control-page development runs used `https://example.com`.** Those
  rows are in the committed history and are distinguishable by their `url`
  field. Any citable analysis **must filter by `url`** — rows from before
  the control page existed are development data, not published results.
- **N per provider is small in early runs** (dozens of cycles, not
  thousands). CIs reflect that.
- **Single region.** All runs come from one runner; no geographic spread
  yet.
- **Sandbox providers are limited to those with official Node SDKs.**
  Modal is excluded — no official Node SDK, and a fetch-based
  reimplementation would measure our client code, not their platform. It is
  listed as "not measured — no access."

## What would falsify this benchmark

| Threat | Mitigation / detection |
| --- | --- |
| Harness clock skew | All phase timestamps in a cycle come from one monotonic `process.hrtime.bigint()` clock on one machine. No cross-machine timing is ever compared. Raw ns offsets are committed, so any skew is recomputable from raw data. |
| Control page CDN changes | The page is **version-pinned** (`v1`), content is deterministic (seeded generator, fixed size). Any content change requires bumping the version in `control-page/index.html` and a new dated entry in this file's changelog, invalidating historical comparisons. Changes are detectable in the git history of `control-page/`. |
| SDK version drift | Every row records the SDK name and version in `provider_meta.sdk_version` (`"unknown"` when the SDK's package.json is not resolvable — disclosed, not hidden). Version drift is diffable per run from the committed rows. |
| Harness behavior drift | Every row carries `harness.git_hash` and `bench_version`, so any published number is attributable to the exact harness code that produced it. |
| Post-hoc cherry-picking | Data is append-only JSONL committed by CI. Failures are published with error strings. No run is excluded after the fact (rule 4). |

## Changelog

Append-only. New methodology changes go here as new dated entries; existing
entries are never edited.

- **2026-09-02** — Initial pre-registration: interleaved execution, raw ns
  phase timestamps, bootstrap CIs, browser/sandbox/stealth/sustained
  protocols, control page `v1`, CI on 6h cron. Committed before any
  published results were generated.