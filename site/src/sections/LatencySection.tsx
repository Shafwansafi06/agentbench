import { useEffect, useRef } from "react";
import gsap from "gsap";
import AnimatedContent from "../components/AnimatedContent";
import CountUp from "../components/CountUp";
import { fmtMs, pct, type Aggregate, type Summary } from "../data";

export default function LatencySection({ summary }: { summary: Summary }) {
  const rows = summary.aggregates
    .filter((a) => a.primitive === "browser" && Number.isFinite(a.full_round_trip_ms.p50))
    .sort((a, b) => a.full_round_trip_ms.p50 - b.full_round_trip_ms.p50);
  const maxP50 = Math.max(...rows.map((r) => r.full_round_trip_ms.p50), 1);

  return (
    <section className="ab-section" id="latency">
      <h2 className="ab-h2">
        <span className="idx">01</span> full round trip
      </h2>
      <p className="ab-sub">
        session create → CDP connect → navigate control page → teardown. p50 / p95 with bootstrap
        95% CI / p99, measured cycles only. dns / ttfb / dcl are measured{" "}
        <strong style={{ color: "var(--fg)" }}>inside each provider&apos;s browser</strong> — their
        network, not ours.
      </p>

      <AnimatedContent>
        <div className="ab-card">
          <table className="ab-table">
            <thead>
              <tr>
                <th>provider</th>
                <th className="num">success</th>
                <th className="num">p50 (ms)</th>
                <th className="num">p95 [95% CI]</th>
                <th className="num">p99</th>
                <th className="num">session_create</th>
                <th className="num">first_nav</th>
                <th className="num">dns</th>
                <th className="num">ttfb</th>
                <th className="num">dcl</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <Row key={a.provider} a={a} i={i} maxP50={maxP50} />
              ))}
            </tbody>
          </table>
        </div>
      </AnimatedContent>

      {summary.skipped_non_control_rows ? (
        <p className="ab-sub" style={{ marginTop: 12 }}>
          {summary.skipped_non_control_rows} pre-control-page dev rows excluded from these
          aggregates (methodology: url filter).
        </p>
      ) : null}
    </section>
  );
}

function Row({ a, i, maxP50 }: { a: Aggregate; i: number; maxP50: number }) {
  const barRef = useRef<HTMLSpanElement>(null);
  const leader = i === 0;

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const width = (a.full_round_trip_ms.p50 / maxP50) * 100;
    const tween = gsap.fromTo(
      el,
      { width: "0%" },
      {
        width: `${width}%`,
        duration: 1.2,
        delay: 0.15 + i * 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 92%", toggleActions: "play none none none" },
      }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [a, i, maxP50]);

  return (
    <tr className={leader ? "ab-leader" : ""}>
      <td>
        <span className="ab-name">
          <span className="ab-pip" />
          {leader ? "① " : ""}
          {a.provider}
        </span>
      </td>
      <td className="num">{pct(a.success_rate)}</td>
      <td className="num">
        <span className="ab-bar-track">
          <span className="ab-bar-fill" ref={barRef} style={{ display: "block" }} />
        </span>
        <CountUp value={a.full_round_trip_ms.p50} />
      </td>
      <td className="num">
        {fmtMs(a.full_round_trip_ms.p95)}{" "}
        <span className="ab-ci">[{fmtMs(a.full_round_trip_ms.ci95_p95[0])}, {fmtMs(a.full_round_trip_ms.ci95_p95[1])}]</span>
      </td>
      <td className="num">{fmtMs(a.full_round_trip_ms.p99)}</td>
      <td className="num">{fmtMs(a.phases_ms.session_create?.p50)}</td>
      <td className="num">{fmtMs(a.phases_ms.first_navigation?.p50)}</td>
      <td className="num">{fmtMs(a.nav_breakdown_ms.dns, 1)}</td>
      <td className="num">{fmtMs(a.nav_breakdown_ms.ttfb, 1)}</td>
      <td className="num">{fmtMs(a.nav_breakdown_ms.dom_content_loaded, 1)}</td>
    </tr>
  );
}
