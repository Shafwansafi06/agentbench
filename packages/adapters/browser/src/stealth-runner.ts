import type { BrowserProviderAdapter } from "@agentbench/core";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { STEALTH_CHECKS, type StealthChecks } from "./stealth.js";
import type { StealthCycleResult } from "./stealth-helpers.js";

/**
 * Runs the stealth gauntlet interleaved across providers (same discipline
 * as the latency runner) and writes one JSONL row per cycle: per-check
 * booleans plus pass rate. Warmups included but flagged.
 */
export async function runStealthGauntlet(cfg: {
  providers: (BrowserProviderAdapter & { runStealthCycle?: () => Promise<StealthCycleResult> })[];
  n: number;
  warmup: number;
  region: string;
  outDir: string;
  runId?: string;
  onCycle?: (row: StealthRecord) => void;
}): Promise<{ runId: string; outPath: string; records: StealthRecord[] }> {
  const runId = cfg.runId ?? `stealth-${Date.now()}`;
  const outPath = join(cfg.outDir, `run-stealth-${runId}.jsonl`);
  const records: StealthRecord[] = [];
  const providers = [...cfg.providers].sort((a, b) => a.name.localeCompare(b.name));

  const totalRounds = cfg.warmup + cfg.n;
  for (let iteration = 0; iteration < totalRounds; iteration++) {
    const warmup = iteration < cfg.warmup;
    for (const provider of providers) {
      if (!provider.runStealthCycle) continue;
      let error: string | undefined;
      let checks: StealthChecks | undefined;
      try {
        const result = await provider.runStealthCycle();
        checks = result.checks;
        error = result.error;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }

      const passed = checks
        ? STEALTH_CHECKS.filter((k) => checks?.[k]).length
        : 0;
      const row: StealthRecord = {
        schema_version: 1,
        run_id: runId,
        iteration,
        warmup,
        region: cfg.region,
        timestamp: new Date().toISOString(),
        provider: provider.name,
        primitive: "stealth",
        checks: checks
          ? ({ ...checks } as Record<string, boolean>)
          : Object.fromEntries(STEALTH_CHECKS.map((k) => [k, false])),
        checks_passed: passed,
        checks_total: STEALTH_CHECKS.length,
        success: error === undefined && checks !== undefined,
        ...(error !== undefined ? { error } : {}),
      };
      mkdirSync(cfg.outDir, { recursive: true });
      appendFileSync(outPath, JSON.stringify(row) + "\n", "utf8");
      records.push(row);
      cfg.onCycle?.(row);
    }
  }

  return { runId, outPath, records };
}

export interface StealthRecord {
  schema_version: 1;
  run_id: string;
  iteration: number;
  warmup: boolean;
  region: string;
  timestamp: string;
  provider: string;
  primitive: "stealth";
  checks: Record<string, boolean>;
  checks_passed: number;
  checks_total: number;
  success: boolean;
  error?: string;
}

export { STEALTH_CHECKS, evaluateStealth } from "./stealth.js";
export { runStealthWithSteps, type StealthCycleResult } from "./stealth-helpers.js";
