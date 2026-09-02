# METHODOLOGY — DRAFT, NOT PRE-REGISTERED

**Status: DRAFT.** This file must be finalized, dated, and committed before the
first published run. Until then, any numbers in `data/` are development runs
against a placeholder control page and are not citable.

## What will be measured

### Browser providers

Metrics per cycle:

- `session_create` — API call → session ready
- `cdp_connect` — attach to browser via CDP **and** acquire a page. For SDKs
  that fuse session creation and connection (e.g. Solari `launch()`), the two
  phases are not separately observable; this is recorded in `fused_phases` and
  the fused span must not be interpreted as a split.
- `first_navigation` — page acquired → `domcontentloaded` on the control page
- `teardown` — release session / close browser
- `full_round_trip` — t0 of `session_create` → end of `teardown` (composite)
- `success_rate` — cycles completing without error

### Planned additions (must exist before first published run)

- Self-hosted control page with fixed payload, DNS/TLS/TTFB measured separately
- Interleaved execution: round-robin across providers within every cycle
- N >= 50 per provider per run, 3 warmup runs discarded per provider (warmups
  are also interleaved and are stored with `warmup: true`, never cherry-picked)
- p50/p95/p99 with bootstrap 95% CIs (2000 resamples, fixed seed)
- Raw ns phase timestamps in every JSONL row — durations are recomputed, never
  stored pre-aggregated
- Every row carries: ISO timestamp, region, provider name + plan tier, harness
  version, node version, git hash, schema version

## Rules

1. Publish whatever the numbers say, including failures and outliers.
2. Warmups are disclosed; nothing is discarded silently.
3. Providers are notified and given a chance to comment before publication.
4. No run is excluded after the fact. Outliers are published and discussed.

## Known limitations (grows as they are discovered)

- (draft — fill in before first published run)
