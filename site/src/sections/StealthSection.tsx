import AnimatedContent from "../components/AnimatedContent";
import CountUp from "../components/CountUp";
import GlareHover from "../components/GlareHover";
import { pct, type Summary } from "../data";

export default function StealthSection({ summary }: { summary: Summary }) {
  const rows = summary.aggregates
    .filter((a) => a.primitive === "stealth" && a.stealth)
    .sort((a, b) => (b.stealth!.pass_rate ?? 0) - (a.stealth!.pass_rate ?? 0));

  if (rows.length === 0) return null;

  const checkKeys = Object.keys(rows[0].stealth!.checks);

  return (
    <section className="ab-section" id="stealth">
      <h2 className="ab-h2">
        <span className="idx">02</span> stealth gauntlet
      </h2>
      <p className="ab-sub">
        seven self-contained fingerprint checks, evaluated inside each provider&apos;s browser — no
        third-party bot-detection sites, fully reproducible. A fingerprintable browser is an agent
        reliability cost: the target site decides your agent is a bot.
      </p>

      <AnimatedContent className="ab-stealth-grid">
        {rows.map((a) => (
          <GlareHover key={a.provider} className="ab-stealth-card">
            <div className="ab-stealth-head">
              <span className="name">{a.provider}</span>
              <span
                className="score"
                style={{
                  color: a.stealth!.pass_rate >= 0.8 ? "var(--acc)" : a.stealth!.pass_rate >= 0.5 ? "var(--warn)" : "var(--bad)",
                }}
              >
                <CountUp value={a.stealth!.pass_rate * 100} suffix="%" />
              </span>
            </div>
            {checkKeys.map((k) => {
              const v = a.stealth!.checks[k];
              const good = Number.isFinite(v) && v >= 0.99;
              return (
                <div className="ab-checkrow" key={k}>
                  <span>{k.replace(/_/g, " ")}</span>
                  <span className={good ? "ok" : "no"}>
                    {Number.isFinite(v) ? pct(v) : "—"}
                  </span>
                </div>
              );
            })}
          </GlareHover>
        ))}
      </AnimatedContent>
    </section>
  );
}
