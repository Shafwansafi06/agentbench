import type { CycleRecord } from "@agentbench/core";
import { summarize } from "@agentbench/core";
import { BROWSER_PHASES } from "@agentbench/core";

const MS = 1e6; // ns -> ms

function ms(ns: number | undefined): string {
  if (ns === undefined) return "—";
  return (ns / MS).toFixed(1);
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length))
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => (c ?? "").padEnd(widths[i] as number)).join("  ");
  return [line(headers), line(headers.map((h) => "─".repeat(h.length))), ...rows.map(line)].join(
    "\n"
  );
}

/**
 * Composite metric table: full_round_trip p50/p95/p99 + success rate,
 * measured cycles only (warmups excluded).
 */
export function compositeTable(records: CycleRecord[]): string {
  const byProvider = new Map<string, number[]>();
  const attempts = new Map<string, { ok: number; total: number }>();
  for (const r of records) {
    if (r.warmup) continue;
    const ok = byProvider.get(r.provider) ?? [];
    const count = attempts.get(r.provider) ?? { ok: 0, total: 0 };
    count.total++;
    if (r.success && r.full_round_trip_ns !== undefined) {
      ok.push(r.full_round_trip_ns);
      count.ok++;
    }
    attempts.set(r.provider, count);
    byProvider.set(r.provider, ok);
  }

  const rows: string[][] = [];
  for (const [provider, samples] of byProvider) {
    const count = attempts.get(provider) as { ok: number; total: number };
    if (samples.length === 0) {
      rows.push([provider, "0", "0%", "—", "—", "—"]);
      continue;
    }
    const s = summarize(samples);
    rows.push([
      provider,
      `${count.ok}/${count.total}`,
      `${((count.ok / count.total) * 100).toFixed(0)}%`,
      (s.p50 / MS).toFixed(1),
      `${(s.p95 / MS).toFixed(1)} [${(s.ci95_p95[0] / MS).toFixed(0)}, ${(s.ci95_p95[1] / MS).toFixed(0)}]`,
      (s.p99 / MS).toFixed(1),
    ]);
  }
  return table(
    ["provider", "ok", "rate", "p50(ms)", "p95(ms) [95% CI]", "p99(ms)"],
    rows
  );
}

/** Per-phase p50 table, measured cycles only. */
export function phaseTable(records: CycleRecord[]): string {
  const byProviderPhase = new Map<string, Map<string, number[]>>();
  for (const r of records) {
    if (r.warmup || !r.success) continue;
    let phases = byProviderPhase.get(r.provider);
    if (!phases) {
      phases = new Map();
      byProviderPhase.set(r.provider, phases);
    }
    for (const [phase, span] of Object.entries(r.phases)) {
      const arr = phases.get(phase) ?? [];
      arr.push(span.t1 - span.t0);
      phases.set(phase, arr);
    }
  }

  const headers = ["provider", "session_create", "cdp_connect", "first_nav", "teardown"];
  const rows: string[][] = [];
  for (const [provider, phases] of byProviderPhase) {
    const row: string[] = [provider];
    for (const phase of BROWSER_PHASES) {
      const samples = phases.get(phase);
      if (!samples || samples.length === 0) {
        row.push("—");
        continue;
      }
      const fused = records.some(
        (r) => r.provider === provider && r.fused_phases.includes(phase)
      );
      const p50 = summarize(samples).p50 / MS;
      row.push(fused ? `${p50.toFixed(1)}*` : p50.toFixed(1));
    }
    rows.push(row);
  }
  const fusedNote = "\n(* = fused with session_create by the provider SDK; not a split)";
  return table(headers, rows) + fusedNote;
}

export function failedCycles(records: CycleRecord[]): string[] {
  const out: string[] = [];
  for (const r of records) {
    if (r.warmup || !r.error) continue;
    out.push(`${r.provider} #${r.iteration}: ${r.error}`);
  }
  return out;
}
