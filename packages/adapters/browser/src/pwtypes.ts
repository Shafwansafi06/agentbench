/**
 * Minimal structural types for the Playwright surface adapters rely on.
 * Structural on purpose: provider SDKs ship their own (sometimes re-bundled)
 * Playwright typings and exact-version matching is a losing game.
 */
export interface PWPageLike {
  goto(
    url: string,
    opts?: { waitUntil?: string; timeout?: number }
  ): Promise<unknown>;
  evaluate<T = unknown>(
    fn: string | ((arg?: unknown) => unknown),
    arg?: unknown
  ): Promise<T>;
}

/**
 * Reads the PerformanceNavigationTiming entry for the last main-frame
 * navigation, from INSIDE the provider's browser. This measures the
 * provider's own network path (dns/tcp/tls/ttfb/content in ms) — the
 * baseline for isolating provider overhead from harness-side noise.
 * Returns undefined when the API is unavailable; never throws into the
 * cycle result (a missing breakdown must not fail a latency measurement).
 */
export async function extractNavBreakdown(
  page: PWPageLike
): Promise<Record<string, number> | undefined> {
  try {
    const raw = await page.evaluate(
      `(() => {
        const entries = performance.getEntriesByType("navigation");
        const nav = entries[entries.length - 1];
        if (!nav) return null;
        const pick = (v) => (typeof v === "number" && v >= 0 && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : undefined);
        return {
          dns: pick(nav.domainLookupEnd - nav.domainLookupStart),
          tcp: pick(nav.connectEnd - nav.connectStart),
          tls: pick(nav.secureConnectionStart > 0 ? nav.connectEnd - nav.secureConnectionStart : 0),
          ttfb: pick(nav.responseStart - nav.requestStart),
          content: pick(nav.responseEnd - nav.responseStart),
          dom_content_loaded: pick(nav.domContentLoadedEventEnd - nav.startTime),
        };
      })()`
    );
    if (typeof raw !== "object" || raw === null) return undefined;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "number") out[k] = v;
    }
    return out;
  } catch {
    return undefined;
  }
}

export interface PWBrowserLike {
  newPage(): Promise<PWPageLike>;
  close(): Promise<void>;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
