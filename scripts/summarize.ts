/**
 * Aggregates every JSONL run in data/runs into data/summary.json for the
 * dashboard and the public API endpoint. Deterministic: re-running on the
 * same data produces the same summary.
 *
 * Percentiles only from measured cycles (warmups excluded, failures
 * excluded from latency but counted into success_rate — both disclosed).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { percentile, bootstrapCI } from "@agentbench/core";
import type { CycleRecord } from "@agentbench/core";

const DATA_DIR = join(process.cwd(), "data", "runs");
const OUT = join(process.cwd(), "data", "summary.json");

interface Aggregate {
  provider: string;
  primitive: string;
  runs: number;
  cycles: number;
  success_rate: number;
  full_round_trip_ms: { p50: number; p95: number; p99: number; ci95_p95: [number, number] };
  phases_ms: Record<string, { p50: number; p95: number }>;
  nav_breakdown_ms: Record<string, number>;
  stealth?: { pass_rate: number; checks: Record<string, number> };
}

function percentileOf(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return percentile(sorted, p);
}

function main(): void {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".jsonl"));
  const byKey = new Map<string, { trips: number[]; ok: number; total: number; phases: Map<string, number[]>; nav: Map<string, number[]> }>();
  const stealthBy = new Map<string, { total: number; passed: number; checks: Map<string, number[]>; cycles: number }>();

  for (const file of files) {
    const rows = readFileSync(join(DATA_DIR, file), "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Record<string, unknown> & { provider: string; warmup: boolean; success: boolean });

    for (const r of rows) {
      if (r.warmup) continue;

      if (r.primitive === "stealth") {
        const rec = r as unknown as { checks: Record<string, boolean>; checks_passed: number; checks_total: number; success: boolean };
        if (!rec.success) continue;
        const s = stealthBy.get(r.provider) ?? { total: 0, passed: 0, checks: new Map(), cycles: 0 };
        s.total += rec.checks_total;
        s.passed += rec.checks_passed;
        s.cycles++;
        for (const [k, v] of Object.entries(rec.checks)) {
          const arr = s.checks.get(k) ?? [];
          arr.push(v ? 1 : 0);
          s.checks.set(k, arr);
        }
        stealthBy.set(r.provider, s);
        continue;
      }

      const key = `${r.provider}|${String(r.primitive)}`;
      const agg = byKey.get(key) ?? {
        trips: [], ok: 0, total: 0, phases: new Map<string, number[]>(), nav: new Map<string, number[]>(),
      };
      agg.total++;
      if (r.success && typeof r.full_round_trip_ns === "number") {
        agg.ok++;
        agg.trips.push(r.full_round_trip_ns / 1e6);
      }
      const phases = (r.phases ?? {}) as Record<string, { t0: number; t1: number }>;
      for (const [phase, span] of Object.entries(phases)) {
        const arr = agg.phases.get(phase) ?? [];
        arr.push((span.t1 - span.t0) / 1e6);
        agg.phases.set(phase, arr);
      }
      const nav = r.nav_breakdown_ms as Record<string, number> | undefined;
      if (nav) {
        for (const [k, v] of Object.entries(nav)) {
          const arr = agg.nav.get(k) ?? [];
          arr.push(v);
          agg.nav.set(k, arr);
        }
      }
      byKey.set(key, agg);
    }
  }

  const aggregates: Aggregate[] = [];
  for (const [key, agg] of byKey) {
    const [provider, primitive] = key.split("|");
    if (agg.trips.length === 0) {
      aggregates.push({
        provider: provider as string,
        primitive: primitive as string,
        runs: agg.total,
        cycles: agg.total,
        success_rate: 0,
        full_round_trip_ms: { p50: NaN, p95: NaN, p99: NaN, ci95_p95: [NaN, NaN] },
        phases_ms: {},
        nav_breakdown_ms: {},
      });
      continue;
    }
    const phases_ms: Aggregate["phases_ms"] = {};
    for (const [phase, samples] of agg.phases) {
      phases_ms[phase] = {
        p50: percentileOf(samples, 0.5),
        p95: percentileOf(samples, 0.95),
      };
    }
    const nav_breakdown_ms: Record<string, number> = {};
    for (const [k, samples] of agg.nav) {
      nav_breakdown_ms[k] = percentileOf(samples, 0.5);
    }
    const ci = bootstrapCI(agg.trips, 0.95, { iterations: 1000 });
    aggregates.push({
      provider: provider as string,
      primitive: primitive as string,
      runs: agg.total,
      cycles: agg.total,
      success_rate: agg.ok / agg.total,
      full_round_trip_ms: {
        p50: percentileOf(agg.trips, 0.5),
        p95: percentileOf(agg.trips, 0.95),
        p99: percentileOf(agg.trips, 0.99),
        ci95_p95: [ci[0], ci[1]],
      },
      phases_ms,
      nav_breakdown_ms,
    });
  }

  for (const [provider, s] of stealthBy) {
    const checks: Record<string, number> = {};
    for (const [k, arr] of s.checks) {
      checks[k] = arr.reduce((a, b) => a + b, 0) / arr.length;
    }
    aggregates.push({
      provider,
      primitive: "stealth",
      runs: s.cycles,
      cycles: s.cycles,
      success_rate: 1,
      full_round_trip_ms: { p50: NaN, p95: NaN, p99: NaN, ci95_p95: [NaN, NaN] },
      phases_ms: {},
      nav_breakdown_ms: {},
      stealth: {
        pass_rate: s.total > 0 ? s.passed / s.total : 0,
        checks,
      },
    });
  }

  const summary = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    aggregates,
  };
  writeFileSync(OUT, JSON.stringify(summary, null, 2) + "\n");
  console.log(`summary: ${aggregates.length} aggregates -> ${OUT}`);
}

main();
