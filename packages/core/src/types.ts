export type Primitive = "browser" | "sandbox";

/**
 * Canonical lifecycle phases for a browser benchmark cycle.
 *
 * `cdp_connect` includes CDP attach + page acquisition. Some SDKs fuse
 * session creation and connection into one call; those providers list the
 * unobservable phase in `fusedPhases` and consumers must not interpret the
 * fused span as a split.
 */
export const BROWSER_PHASES = [
  "session_create",
  "cdp_connect",
  "first_navigation",
  "teardown",
] as const;

export type BrowserPhase = (typeof BROWSER_PHASES)[number];

/** Raw phase span, in nanoseconds offset from cycle start. */
export interface PhaseSpan {
  /** ns offset from cycle start */
  t0: number;
  /** ns offset from cycle start */
  t1: number;
}

export interface PhaseSpanMap {
  [phase: string]: PhaseSpan;
}

export interface ProviderMeta {
  [key: string]: unknown;
}

/** A single measured cycle. One JSONL row. */
export interface CycleRecord {
  schema_version: 1;
  run_id: string;
  provider: string;
  primitive: Primitive;
  /** iteration index within the run, 0-based, warmups included */
  iteration: number;
  warmup: boolean;
  region: string;
  timestamp: string;
  url: string;
  harness: {
    node_version: string;
    bench_version: string;
    git_hash?: string;
  };
  provider_meta: ProviderMeta;
  /** raw phase timestamps (ns offsets from cycle start); recomputed, never aggregated */
  phases: PhaseSpanMap;
  /** phases not separately observable from the provider SDK */
  fused_phases: string[];
  error?: string;
  success: boolean;
  /** t0 of first phase -> t1 of teardown, in ns */
  full_round_trip_ns?: number;
}

export interface BenchmarkRunConfig {
  providers: BrowserProviderAdapter[];
  /** measured cycles per provider (warmups excluded) */
  n: number;
  /** warmup cycles per provider, discarded from analysis but recorded */
  warmup: number;
  url: string;
  region: string;
  /** directory for JSONL output */
  outDir: string;
  runId?: string;
  onCycle?: (record: CycleRecord) => void;
}

export interface RunSummary {
  runId: string;
  outPath: string;
  records: CycleRecord[];
}

/**
 * The one interface every browser provider implements. Small on purpose:
 * this is the extension point contributors use to add providers.
 */
export interface BrowserProviderAdapter {
  name: string;
  primitive: "browser";
  /** Env/config check. Missing keys are surfaced, never silently skipped. */
  availability(): { available: boolean; missing: string[] };
  /** Disclosed alongside results: sdk name/version, plan tier, region options. */
  meta(): ProviderMeta;
  /**
   * One full instrumented lifecycle: create session, connect, navigate,
   * teardown. Timing is the adapter's responsibility (it can see its own
   * call boundaries); the core aggregates and stores.
   * Implementations must be safe to run interleaved with other providers.
   */
  runCycle(url: string): Promise<{
    phases: PhaseSpanMap;
    fusedPhases: string[];
    providerMeta: ProviderMeta;
    error?: string;
  }>;
  /** Release any long-lived client resources. Called once after the run. */
  dispose(): Promise<void>;
}
