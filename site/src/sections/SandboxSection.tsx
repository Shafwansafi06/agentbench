import AnimatedContent from "../components/AnimatedContent";
import CountUp from "../components/CountUp";
import { fmtMs, pct, type Summary } from "../data";

export default function SandboxSection({ summary }: { summary: Summary }) {
  const rows = summary.aggregates
    .filter((a) => a.primitive === "sandbox" && Number.isFinite(a.full_round_trip_ms.p50))
    .sort((a, b) => a.full_round_trip_ms.p50 - b.full_round_trip_ms.p50);

  if (rows.length === 0) return null;
  const maxP50 = Math.max(...rows.map((r) => r.full_round_trip_ms.p50), 1);

  return (
    <section className="ab-section" id="sandbox">
      <h2 className="ab-h2">
        <span className="idx">03</span> sandbox
      </h2>
      <p className="ab-sub">
        microVM lifecycle: create → first exec → <strong style={{ color: "var(--fg)" }}>marginal
        cost of a second command</strong> (exec_overhead — the number that dominates agent loops) →
        1 MB file write → teardown.
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
                <th className="num">create</th>
                <th className="num">first_exec</th>
                <th className="num">exec_overhead</th>
                <th className="num">fs_write_1mb</th>
                <th className="num">teardown</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.provider} className={i === 0 ? "ab-leader" : ""}>
                  <td>
                    <span className="ab-name">
                      <span className="ab-pip" />
                      {i === 0 ? "① " : ""}
                      {a.provider}
                    </span>
                  </td>
                  <td className="num">{pct(a.success_rate)}</td>
                  <td className="num">
                    <span className="ab-bar-track">
                      <span
                        className="ab-bar-fill"
                        style={{
                          display: "block",
                          width: `${(a.full_round_trip_ms.p50 / maxP50) * 100}%`,
                        }}
                      />
                    </span>
                    <CountUp value={a.full_round_trip_ms.p50} />
                  </td>
                  <td className="num">
                    {fmtMs(a.full_round_trip_ms.p95)}{" "}
                    <span className="ab-ci">
                      [{fmtMs(a.full_round_trip_ms.ci95_p95[0])}, {fmtMs(a.full_round_trip_ms.ci95_p95[1])}]
                    </span>
                  </td>
                  <td className="num">{fmtMs(a.phases_ms.create?.p50)}</td>
                  <td className="num">{fmtMs(a.phases_ms.first_exec?.p50)}</td>
                  <td className="num">{fmtMs(a.phases_ms.exec_overhead?.p50)}</td>
                  <td className="num">{fmtMs(a.phases_ms.filesystem_write_1mb?.p50)}</td>
                  <td className="num">{fmtMs(a.phases_ms.teardown?.p50)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnimatedContent>
    </section>
  );
}
