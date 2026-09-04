import CountUp from "../components/CountUp";
import type { Summary } from "../data";

export default function StatsStrip({ summary }: { summary: Summary }) {
  const agg = summary.aggregates;
  const providers = new Set(agg.map((a) => a.provider)).size;
  const cycles = agg.reduce((s, a) => s + a.cycles, 0);
  const stealthCycles = agg
    .filter((a) => a.primitive === "stealth")
    .reduce((s, a) => s + a.cycles, 0);
  const avgSuccess =
    agg.filter((a) => a.primitive !== "stealth" && a.cycles > 0)
      .reduce((s, a) => s + a.success_rate, 0) /
    Math.max(1, agg.filter((a) => a.primitive !== "stealth" && a.cycles > 0).length);

  const stats: { v: number; d?: number; suffix?: string; k: string }[] = [
    { v: providers, k: "providers measured" },
    { v: cycles, k: "cycles collected" },
    { v: stealthCycles, k: "stealth gauntlet runs" },
    { v: avgSuccess * 100, d: 0, suffix: "%", k: "mean success rate" },
  ];

  return (
    <section className="ab-stats">
      {stats.map((s) => (
        <div className="ab-stat" key={s.k}>
          <div className="v">
            <CountUp value={s.v} decimals={s.d ?? 0} suffix={s.suffix ?? ""} />
          </div>
          <div className="k">{s.k}</div>
        </div>
      ))}
    </section>
  );
}
