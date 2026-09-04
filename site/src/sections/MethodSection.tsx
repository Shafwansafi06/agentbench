import AnimatedContent from "../components/AnimatedContent";
import type { Summary } from "../data";

const REPO = "https://github.com/Shafwansafi06/agentbench";

export default function MethodSection({ summary }: { summary: Summary }) {
  return (
    <AnimatedContent>
      <div className="ab-method">
        <p style={{ marginBottom: 10 }}>
          <strong>Method.</strong> Providers are round-robined <strong>within every cycle</strong> —
          never sequential, because sequential runs let time-of-day and network conditions bias the
          comparison (the mistake most vendor benchmarks carry). Warmups are interleaved, recorded
          with a flag, and never silently discarded.
        </p>
        <p style={{ marginBottom: 10 }}>
          Every phase boundary is stored as a <strong>raw nanosecond timestamp</strong> in
          append-only JSONL — <code>data/runs/</code>, committed to the repo by CI every 6 hours.
          Percentiles are recomputed from raw data, never pre-aggregated, with fixed-seed bootstrap
          95% CIs. Failures are published with their error strings; nothing is filtered.
        </p>
        <p style={{ marginBottom: 10 }}>
          Navigation targets a version-pinned ~80&nbsp;KiB self-hosted control page — never
          example.com — and DNS/TLS/TTFB are read from the provider&apos;s own browser via
          PerformanceNavigationTiming, so network is separated from provider overhead.
          Solari&apos;s SDK fuses session create + connect; that phase is marked{" "}
          <code>fused</code> in the data instead of being presented as a split.
        </p>
        <p>
          <strong>Data as of</strong> {new Date(summary.generated_at).toISOString().slice(0, 16).replace("T", " ")} UTC
          {" · "}
          <a href={`${REPO}/blob/main/METHODOLOGY.md`}>full pre-registered methodology</a>
          {" · "}
          <a href={`${REPO}/tree/main/data/runs`}>raw data</a>
          {" · "}
          <a href={`${REPO}/blob/main/CONTRIBUTING.md`}>add your provider</a>
        </p>
      </div>
    </AnimatedContent>
  );
}
