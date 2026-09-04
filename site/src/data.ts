export interface Aggregate {
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

export interface Summary {
  schema_version: 1;
  generated_at: string;
  control_page_filter?: string;
  skipped_non_control_rows?: number;
  aggregates: Aggregate[];
}

const REPO_RAW =
  "https://raw.githubusercontent.com/Shafwansafi06/agentbench/main/data/summary.json";

/**
 * Data freshness over deployment freshness: primary source is the repo
 * itself (updated by CI every 6h), local /summary.json is the fallback.
 */
export async function loadSummary(): Promise<Summary> {
  const sources = [REPO_RAW, "/summary.json"];
  let lastError: unknown = null;
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Summary;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("no data source reachable");
}

export function fmtMs(x: number | undefined, decimals = 0): string {
  return x !== undefined && Number.isFinite(x) ? x.toFixed(decimals) : "—";
}

export function pct(x: number, decimals = 0): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(decimals)}%` : "—";
}
