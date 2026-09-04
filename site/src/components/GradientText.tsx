/**
 * React Bits pattern (reactbits.dev, MIT) — animated gradient text.
 */
import type { CSSProperties, ReactNode } from "react";

interface GradientTextProps {
  children: ReactNode;
  colors?: string[];
  className?: string;
  animationSpeed?: number;
}

export default function GradientText({
  children,
  colors = ["#5eead4", "#818cf8", "#e879f9", "#5eead4"],
  className,
  animationSpeed = 6,
}: GradientTextProps) {
  const style: CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})`,
    backgroundSize: "300% 100%",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    animation: `ab-gradient-move ${animationSpeed}s linear infinite`,
  };
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
}
