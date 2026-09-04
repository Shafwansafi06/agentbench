/**
 * React Bits pattern (reactbits.dev, MIT) — glare hover card.
 */
import { useRef, type CSSProperties, type ReactNode, type MouseEvent } from "react";

interface GlareHoverProps {
  children: ReactNode;
  className?: string;
  glareColor?: string;
  glareOpacity?: number;
  style?: CSSProperties;
}

export default function GlareHover({
  children,
  className,
  glareColor = "rgba(94, 234, 212, 0.16)",
  glareOpacity = 1,
  style,
}: GlareHoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--glare-x", `${x}px`);
    el.style.setProperty("--glare-y", `${y}px`);
    el.style.setProperty("--glare-o", String(glareOpacity));
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--glare-o", "0");
  };

  return (
    <div
      ref={ref}
      className={className ? `${className} ab-glare` : "ab-glare"}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={
        {
          "--glare-color": glareColor,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
