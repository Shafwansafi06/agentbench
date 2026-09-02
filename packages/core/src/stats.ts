/**
 * Percentiles use linear interpolation between closest ranks.
 * Samples MUST be sorted ascending. Arrays are never mutated by callers'
 * contract violation — defensive copy is the caller's job.
 */
export function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) throw new Error("percentile of empty sample");
  if (p <= 0) return sortedAsc[0] as number;
  if (p >= 1) return sortedAsc[sortedAsc.length - 1] as number;

  const rank = (sortedAsc.length - 1) * p;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo] as number;
  const frac = rank - lo;
  return (sortedAsc[lo] as number) * (1 - frac) + (sortedAsc[hi] as number) * frac;
}

/** Deterministic PRNG so bootstrap CIs are reproducible run-to-run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap 95% CI for a percentile, via fixed-seed percentile resampling.
 * 2000 resamples by default; deterministic for a given sample set.
 */
export function bootstrapCI(
  samples: readonly number[],
  p: number,
  opts: { iterations?: number; seed?: number; alpha?: number } = {}
): [number, number] {
  const iterations = opts.iterations ?? 2000;
  const seed = opts.seed ?? 42;
  const alpha = opts.alpha ?? 0.05;
  if (samples.length === 0) throw new Error("bootstrap of empty sample");

  // Seed with a stable function of the sample to stay deterministic.
  let s = seed;
  for (const x of samples) s = (s * 31 + Math.round(x)) | 0;
  const rand = mulberry32(s);

  const stats: number[] = new Array(iterations);
  for (let i = 0; i < iterations; i++) {
    const resample: number[] = new Array(samples.length);
    for (let j = 0; j < samples.length; j++) {
      resample[j] = samples[Math.floor(rand() * samples.length)] as number;
    }
    resample.sort((a, b) => a - b);
    stats[i] = percentile(resample, p);
  }
  stats.sort((a, b) => a - b);
  const lo = stats[Math.floor((alpha / 2) * iterations)] as number;
  const hi = stats[Math.ceil((1 - alpha / 2) * iterations) - 1] as number;
  return [lo, hi];
}

export interface SampleSummary {
  n: number;
  p50: number;
  p95: number;
  p99: number;
  ci95_p50: [number, number];
  ci95_p95: [number, number];
  min: number;
  max: number;
}

export function summarize(samples: readonly number[]): SampleSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    ci95_p50: bootstrapCI(sorted, 0.5),
    ci95_p95: bootstrapCI(sorted, 0.95),
    min: sorted[0] as number,
    max: sorted[sorted.length - 1] as number,
  };
}
