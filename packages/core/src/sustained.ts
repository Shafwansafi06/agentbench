import type { BrowserProviderAdapter, CycleRecord } from "./types.js";
import { runBenchmark } from "./runner.js";

export interface SustainedReport {
  provider: string;
  cycles: number;
  ok: number;
  firstThird: { p50: number; p95: number; errors: number };
  lastThird: { p50: number; p95: number; errors: number };
  /** p95 last-third minus p95 first-third, in ns. Positive = degradation. */
  degradationP95Ns: number;
}

function percentileOf(samples: number[], p: number): number {
  if (samples.length === 0) return Number.NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo] as number;
  return (sorted[lo] as number) * (1 - (rank - lo)) + (sorted[hi] as number) * rank;
}

function sliceStats(records: CycleRecord[]): { p50: number; p95: number; errors: number } {
  const trips = records
    .filter((r) => r.success && r.full_round_trip_ns !== undefined)
    .map((r) => r.full_round_trip_ns as number)
    .sort((a, b) => a - b);
  const errors = records.filter((r) => !r.success).length;
  const pick = (p: number): number =>
    trips.length === 0
      ? Number.NaN
      : (trips[Math.min(trips.length - 1, Math.floor((trips.length - 1) * p))] as number);
  return { p50: pick(0.5), p95: pick(0.95), errors: records.length - trips.length };
}

/**
 * Sustained agent loop: N sequential create→navigate→teardown cycles against
 * ONE provider, reporting whether p95 degrades over the run (session leaks,
 * rate limits, warm-state drift). Vendors benchmark one cold start; agents
 * do thousands of cycles.
 */
export async function runSustainedLoop(cfg: {
  provider: BrowserProviderAdapter;
  n: number;
  url: string;
  region: string;
  outDir: string;
  onCycle?: (record: CycleRecord) => void;
}): Promise<{ records: CycleRecord[]; report: SustainedReport }> {
  const summary = await runBenchmark({
    providers: [cfg.provider],
    n: cfg.n,
    warmup: 0,
    url: cfg.url,
    region: cfg.region,
    outDir: cfg.outDir,
    onCycle: cfg.onCycle,
  });

  const measured = summary.records.filter((r) => !r.warmup);
  const third = Math.max(1, Math.floor(measured.length / 3));
  const first = measured.slice(0, third);
  const last = measured.slice(-third);

  const f = sliceStats(first);
  const l = sliceStats(last);

  const report: SustainedReport = {
    provider: cfg.provider.name,
    cycles: measured.length,
    ok: measured.filter((r) => r.success).length,
    firstThird: f,
    lastThird: l,
    degradationP95Ns:
      Number.isNaN(f.p95) || Number.isNaN(l.p95) ? Number.NaN : l.p95 - f.p95,
  };

  return { records: measured, report };
}
