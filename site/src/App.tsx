import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { loadSummary, type Summary } from "./data";
import SplitText from "./components/SplitText";
import GradientText from "./components/GradientText";
import ShinyText from "./components/ShinyText";
import StatsStrip from "./sections/StatsStrip";
import LatencySection from "./sections/LatencySection";
import StealthSection from "./sections/StealthSection";
import SandboxSection from "./sections/SandboxSection";
import MethodSection from "./sections/MethodSection";

const REPO = "https://github.com/Shafwansafi06/agentbench";

export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orbsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSummary()
      .then(setSummary)
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const el = orbsRef.current;
    if (!el) return;
    const orbs = el.querySelectorAll(".ab-orb");
    const tweens = Array.from(orbs).map((orb, i) =>
      gsap.to(orb, {
        x: i % 2 === 0 ? 60 : -70,
        y: i % 2 === 0 ? 50 : -60,
        scale: 1.15,
        duration: 9 + i * 3,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      })
    );
    return () => tweens.forEach((t) => t.kill());
  }, []);

  return (
    <div className="ab-bg" ref={orbsRef}>
      <div className="ab-grid" />
      <div className="ab-orb ab-orb--1" />
      <div className="ab-orb ab-orb--2" />
      <div className="ab-orb ab-orb--3" />

      <main className="ab-shell">
        <header className="ab-hero">
          <div className="ab-kicker">
            <span className="ab-dot" />
            <ShinyText speed={5}>LIVE · CI RUNS EVERY 6H · RAW DATA PUBLIC</ShinyText>
          </div>

          <h1 className="ab-title">
            <GradientText colors={["#e7ecf3", "#5eead4", "#818cf8", "#e7ecf3"]} animationSpeed={7}>
              agentbench
            </GradientText>
          </h1>

          <p className="ab-tagline">
            <SplitText text="Vendor benchmarks are marketing." y={18} stagger={0.014} />{" "}
            This one runs on a schedule, in public — <strong>interleaved methodology</strong>,{" "}
            <strong>raw nanosecond data</strong> committed to the repo, every number recomputable.
          </p>

          <div className="ab-ctas">
            <a className="ab-btn ab-btn--primary" href={REPO} target="_blank" rel="noreferrer">
              ★ star the repo
            </a>
            <a className="ab-btn" href="/summary.json" target="_blank" rel="noreferrer">
              data API
            </a>
            <a className="ab-btn" href={`${REPO}/blob/main/METHODOLOGY.md`} target="_blank" rel="noreferrer">
              methodology
            </a>
          </div>
        </header>

        {error && (
          <p className="ab-sub ab-bad">failed to load benchmark data: {error}</p>
        )}

        {summary && (
          <>
            <StatsStrip summary={summary} />
            <LatencySection summary={summary} />
            <StealthSection summary={summary} />
            <SandboxSection summary={summary} />
            <MethodSection summary={summary} />
          </>
        )}

        {!summary && !error && (
          <p className="ab-sub">
            <ShinyText speed={3}>loading live data…</ShinyText>
          </p>
        )}

        <footer className="ab-footer">
          <span>
            built as a Solari build challenge entry · Pinetree Research SWE intern application
          </span>
          <span>
            <a href={REPO}>source</a> · <a href={`${REPO}/tree/main/data/runs`}>raw JSONL</a> · MIT
          </span>
        </footer>
      </main>
    </div>
  );
}
