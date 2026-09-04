/**
 * React Bits pattern (reactbits.dev, MIT) — GSAP SplitText-style staggered
 * character reveal. Written directly; same API surface as the library's.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  y?: number;
}

export default function SplitText({
  text,
  className,
  delay = 0.15,
  duration = 0.9,
  stagger = 0.02,
  y = 28,
}: SplitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chars = el.querySelectorAll(".ab-char");
    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        { y, opacity: 0, rotateX: -60 },
        { y: 0, opacity: 1, rotateX: 0, duration, delay, stagger, ease: "power3.out" }
      );
    }, el);
    return () => ctx.revert();
  }, [text, delay, duration, stagger, y]);

  return (
    <span ref={ref} className={className} style={{ display: "inline-block", perspective: 600 }}>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="ab-char"
          style={{ display: "inline-block", whiteSpace: ch === " " ? "pre" : undefined }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}
