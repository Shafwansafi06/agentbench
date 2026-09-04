/**
 * React Bits pattern (reactbits.dev, MIT) — shimmer sweep text.
 */
import type { ReactNode } from "react";

export default function ShinyText({
  children,
  className,
  speed = 4,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
}) {
  return (
    <span className={className ? `${className} ab-shiny` : "ab-shiny"} style={{ animationDuration: `${speed}s` }}>
      {children}
    </span>
  );
}
