import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { appendJSONL } from "./jsonl.js";
import { gitHash } from "./git.js";
import type {
  BenchmarkRunConfig,
  CycleRecord,
  RunSummary,
} from "./types.js";

export const BENCH_VERSION = "0.1.0";

export function makeRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${randomBytes(3).toString("hex")}`;
}

function firstT0(record: CycleRecord): number | undefined {
  const values = Object.values(record.phases);
  if (values.length === 0) return undefined;
  return Math.min(...values.map((v) => v.t0));
}

/**
 * Interleaved benchmark runner.
 *
 * Cycles are round-robined ACROSS providers within each iteration, so network
 * conditions and time-of-day hit every provider equally. Sequential
 * execution (all of A, then all of B) is the bias most vendor benchmarks
 * carry, and the reason their numbers are not comparable.
 *
 * Warmups run interleaved too and are recorded with `warmup: true`; nothing
 * is discarded silently.
 */
export async function runBenchmark(cfg: BenchmarkRunConfig): Promise<RunSummary> {
  const runId = cfg.runId ?? makeRunId();
  const outPath = join(cfg.outDir, `run-${runId}.jsonl`);
  const records: CycleRecord[] = [];
  const providers = [...cfg.providers].sort((a, b) => a.name.localeCompare(b.name));

  const harness = {
    node_version: process.version,
    bench_version: BENCH_VERSION,
    git_hash: gitHash(),
  };

  const totalRounds = cfg.warmup + cfg.n;
  for (let iteration = 0; iteration < totalRounds; iteration++) {
    const warmup = iteration < cfg.warmup;
    for (const provider of providers) {
      const timestamp = new Date().toISOString();
      let phases: CycleRecord["phases"] = {};
      let fusedPhases: string[] = [];
      let providerMeta: CycleRecord["provider_meta"] = {};
      let navBreakdown: CycleRecord["nav_breakdown_ms"] | undefined;
      let error: string | undefined;

      try {
        const result = await provider.runCycle(cfg.url);
        phases = result.phases;
        fusedPhases = result.fusedPhases;
        providerMeta = result.providerMeta;
        navBreakdown = result.navBreakdown;
        error = result.error;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const t0 = firstT0({
        phases,
      } as unknown as CycleRecord);
      const teardownT1 = phases["teardown"]?.t1;
      const success = error === undefined && teardownT1 !== undefined;

      const record: CycleRecord = {
        schema_version: 1,
        run_id: runId,
        provider: provider.name,
        primitive: provider.primitive,
        iteration,
        warmup,
        region: cfg.region,
        timestamp,
        url: cfg.url,
        harness,
        provider_meta: providerMeta,
        phases,
        fused_phases: fusedPhases,
        ...(navBreakdown !== undefined ? { nav_breakdown_ms: navBreakdown } : {}),
        ...(error !== undefined ? { error } : {}),
        success,
        ...(success && t0 !== undefined
          ? { full_round_trip_ns: teardownT1 - t0 }
          : {}),
      };

      appendJSONL(outPath, record);
      records.push(record);
      cfg.onCycle?.(record);
    }
  }

  return { runId, outPath, records };
}
