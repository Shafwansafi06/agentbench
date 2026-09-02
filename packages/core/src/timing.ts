import type { PhaseSpanMap } from "./types.js";

/**
 * Measures phase boundaries with process.hrtime.bigint() and stores raw
 * nanosecond offsets from cycle start. Durations are derived at write time;
 * raw offsets are kept so metrics can be recomputed later without re-running.
 */
export class PhaseTimer {
  private readonly cycleStart = process.hrtime.bigint();
  private readonly open = new Map<string, bigint>();
  private readonly closed = new Map<string, { t0: bigint; t1: bigint }>();

  begin(phase: string): void {
    if (this.open.has(phase) || this.closed.has(phase)) {
      throw new Error(`phase '${phase}' already started`);
    }
    this.open.set(phase, process.hrtime.bigint());
  }

  end(phase: string): void {
    const t0 = this.open.get(phase);
    if (t0 === undefined) {
      throw new Error(`phase '${phase}' was never started`);
    }
    this.open.delete(phase);
    this.closed.set(phase, { t0, t1: process.hrtime.bigint() });
  }

  elapsedNs(phase: string): number | undefined {
    const span = this.closed.get(phase);
    if (!span) return undefined;
    return Number(span.t1 - span.t0);
  }

  /** ns offsets from cycle start, for every closed phase. */
  snapshot(): PhaseSpanMap {
    const out: PhaseSpanMap = {};
    for (const [name, span] of this.closed) {
      out[name] = {
        t0: Number(span.t0 - this.cycleStart),
        t1: Number(span.t1 - this.cycleStart),
      };
    }
    return out;
  }
}
