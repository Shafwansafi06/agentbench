# CONTRIBUTING

## Add a provider adapter (target: under 30 minutes)

1. Implement `BrowserProviderAdapter` (browser) or `SandboxProviderAdapter`
   (sandbox) — both in `packages/core/src/types.ts` and
   `packages/core/src/sandbox-types.ts`. The interfaces are small on
   purpose: `name`, `primitive`, `availability()`, `meta()`, `runCycle()`,
   `dispose()`.
2. Copy an existing adapter as a starting point
   (`packages/adapters/browser/src/` or
   `packages/adapters/sandbox/src/`). Use `PhaseTimer` from
   `@agentbench/core` for phase boundaries.
3. Extract fields defensively with `sdk-shapes.ts`
   (`packages/adapters/browser/src/sdk-shapes.ts`): `pickField()` probes a
   list of known field names instead of assuming one shape, and `cdpUrlOf()`
   extracts a CDP websocket URL from any session-shaped response — failing
   loudly with the probed keys when none match, so an SDK shape change
   surfaces as a benchmark finding, not a mystery.
4. Register it: **one line** in
   `packages/adapters/browser/src/registry.ts` (`BROWSER_PROVIDERS`) or
   `packages/adapters/sandbox/src/runner.ts` (`SANDBOX_PROVIDERS`).

**Disclosure requirements:** `meta()` must return the SDK name
(`sdk`), the installed SDK version (`sdk_version`), and the plan tier being
tested (`plan_tier` — `undisclosed` is allowed but must be honest). These
are published in every row's `provider_meta`.

**Rules:**

- Never navigate to third-party sites (example.com, google.com, ...) for
  latency numbers. Published numbers target the self-hosted control page
  only (see `control-page/README.md`).
- Never discard failures. A failed cycle is a data row with an error
  string, not a retry loop and not a skip.
- Run interleaved like everyone else. Adapters must be safe to execute
  round-robin alongside other providers — no global state that breaks when
  another provider's cycle runs between yours.

## Local development

```bash
npm install
cp .env.example .env          # fill in keys for the providers you have
npm run providers             # which providers are configured?
npm run bench -- --providers <name> --n 5
```

Other entry points: `--primitive sandbox`, `stealth`, `--sustained N`.
Raw JSONL lands in `data/runs/`.

## Data rules

- `data/` JSONL is **append-only**. Never rewrite, reorder, or delete
  existing run files.
- The `schema_version` field is mandatory on every row.
- A PR that changes the row schema **must bump `schema_version`** and add a
  new dated entry to the Changelog section of `METHODOLOGY.md`. That file
  is append-only once finalized.

## Code style

- TypeScript strict mode (`strict`, `noUncheckedIndexedAccess` — see
  `tsconfig.json`).
- No comments unless they explain a non-obvious decision. The existing
  comment style records *why*, not *what* — keep it that way.