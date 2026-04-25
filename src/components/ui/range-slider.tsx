"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type Range = { min: number; max: number };

/**
 * Dual-thumb range slider. Renders a single track with a highlighted fill
 * between two draggable thumbs. Built on two overlaid native <input
 * type="range"> elements so keyboard accessibility comes for free; pointer
 * events are routed through to whichever thumb the user is interacting with
 * via z-index tracking.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  min: number;
  max: number;
  step?: number;
  value: Range;
  onChange: (next: Range) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [active, setActive] = React.useState<"low" | "high" | null>(null);

  const span = Math.max(max - min, Number.EPSILON);
  const lowPct = clamp(((value.min - min) / span) * 100);
  const highPct = clamp(((value.max - min) / span) * 100);

  // When low and high collide, bring the most-recently-touched thumb to the
  // front so the user can drag it back out. Defaults bias toward "low" since
  // a fresh slider opens with both thumbs at the extremes.
  const lowZ = active === "low" ? 4 : 3;
  const highZ = active === "high" ? 4 : 3;

  return (
    <div className={cn("relative h-5 w-full", className)}>
      {/* Track */}
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
      {/* Filled segment between thumbs */}
      <div
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
      />

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value.min}
        onChange={(e) => {
          const n = Math.min(Number(e.target.value), value.max);
          onChange({ min: n, max: value.max });
        }}
        onPointerDown={() => setActive("low")}
        onFocus={() => setActive("low")}
        className="range-slider-thumb absolute inset-0 h-5 w-full"
        style={{ zIndex: lowZ }}
        aria-label={ariaLabel ? `${ariaLabel} minimum` : "minimum"}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value.max}
        onChange={(e) => {
          const n = Math.max(Number(e.target.value), value.min);
          onChange({ min: value.min, max: n });
        }}
        onPointerDown={() => setActive("high")}
        onFocus={() => setActive("high")}
        className="range-slider-thumb absolute inset-0 h-5 w-full"
        style={{ zIndex: highZ }}
        aria-label={ariaLabel ? `${ariaLabel} maximum` : "maximum"}
      />
    </div>
  );
}

function clamp(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
