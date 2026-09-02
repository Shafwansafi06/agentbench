import { createRequire } from "node:module";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  SandboxProviderAdapter,
  CycleRecord,
} from "@agentbench/core";
import { makeRunId, gitHash, BENCH_VERSION } from "@agentbench/core";
import { SolariSandboxProvider } from "./solari.js";
import { E2BSandboxProvider } from "./e2b.js";
import { DaytonaSandboxProvider } from "./daytona.js";

/**
 * Interleaved sandbox runner — same discipline as the browser runner:
 * round-robin across providers within each iteration, warmups recorded
 * with warmup: true, raw ns phase timestamps in every row.
 */
export async function runSandboxBenchmark(cfg: {
  providers: SandboxProviderAdapter[];
  n: number;
  warmup: number;
  region: string;
  outDir: string;
  runId?: string;
  onCycle?: (record: CycleRecord) => void;
}): Promise<{ runId: string; outPath: string; records: CycleRecord[] }> {
  const runId = cfg.runId ?? makeRunId();
  const outPath = join(cfg.outDir, `run-sandbox-${runId}.jsonl`);
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
      let providerMeta: CycleRecord["provider_meta"] = {};
      let error: string | undefined;

      try {
        const result = await provider.runCycle();
        phases = result.phases;
        providerMeta = result.providerMeta;
        error = result.error;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const teardownT1 = phases["teardown"]?.t1;
      const t0s = Object.values(phases).map((v) => v.t0);
      const t0 = t0s.length > 0 ? Math.min(...t0s) : undefined;
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
        url: "", // sandboxes don't navigate
        harness,
        provider_meta: providerMeta,
        phases,
        fused_phases: [],
        ...(error !== undefined ? { error } : {}),
        success,
        ...(success && t0 !== undefined ? { full_round_trip_ns: teardownT1 - t0 } : {}),
      };

      mkdirSync(cfg.outDir, { recursive: true });
      appendFileSync(outPath, JSON.stringify(record) + "\n", "utf8");
      records.push(record);
      cfg.onCycle?.(record);
    }
  }

  return { runId, outPath, records };
}

/**
 * Registry of sandbox providers. Modal is deliberately absent: no official
 * Node SDK, and a fetch-based reimplementation would measure our client
 * code, not their platform. Listed in results as "not measured — no access".
 */
export const SANDBOX_PROVIDERS: SandboxProviderAdapter[] = [
  new SolariSandboxProvider(),
  new E2BSandboxProvider(),
  new DaytonaSandboxProvider(),
];

export function resolveSandboxProviders(names: string[]): {
  providers: SandboxProviderAdapter[];
  unknown: string[];
  unavailable: { name: string; missing: string[] }[];
} {
  const unknown: string[] = [];
  const unavailable: { name: string; missing: string[] }[] = [];
  const providers: SandboxProviderAdapter[] = [];

  for (const name of names) {
    const found = SANDBOX_PROVIDERS.find((p) => p.name === name);
    if (!found) {
      unknown.push(name);
      continue;
    }
    const status = found.availability();
    if (status.available) providers.push(found);
    else unavailable.push({ name: found.name, missing: status.missing });
  }

  return { providers, unknown, unavailable };
}

export { SolariSandboxProvider, E2BSandboxProvider, DaytonaSandboxProvider };

const req = createRequire(import.meta.url);
export const version = (): string => req("./package.json").version as string;
