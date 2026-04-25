"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

type Section = { term: string; body: React.ReactNode };

const SECTIONS: Section[] = [
  {
    term: "t0.1 duration",
    body: (
      <>
        The industry-standard flash duration measurement. t0.1 is the total time the flash
        spends above 10% of its peak intensity — a shorter value means motion is frozen more
        effectively. (t0.5, measured to 50% of peak, is also common but less useful for
        action photography.) Lower is better; a typical speedlight at full power might be
        around 1/1000s, while a studio strobe in Freeze mode can reach 1/20,000s or shorter.
      </>
    ),
  },
  {
    term: "Power settings (x-axis)",
    body: (
      <>
        Each flash is tested across its full power range. The x-axis can be displayed two
        ways:{" "}
        <strong>fractions</strong> (1/1&nbsp;=&nbsp;full, 1/2&nbsp;=&nbsp;half,
        1/256&nbsp;=&nbsp;minimum) or{" "}
        <strong>stops below full</strong> (0&nbsp;=&nbsp;full, −1&nbsp;=&nbsp;half,
        −8&nbsp;=&nbsp;1/256). Both scales are logarithmic — each step to the left halves
        the power.
      </>
    ),
  },
  {
    term: "Flash modes",
    body: (
      <>
        Many modern flashes offer special high-speed modes — variously called Freeze, Speed,
        Action, or HSS — that use a different discharge circuit to produce a much shorter
        burst. These modes typically sacrifice color accuracy, maximum power output, or
        effective guide number. On this chart, each mode is shown as a separate line with a
        distinct dash pattern so you can compare the same flash across modes.
      </>
    ),
  },
  {
    term: "Absolute Ws toggle",
    body: (
      <>
        By default the x-axis shows each flash on its own relative power scale (1/1 through
        1/N). Switching to <strong>Absolute Ws</strong> re-draws the x-axis in watt-seconds
        so flashes with different max ratings can be compared at the same actual output level
        — for example, a 500&nbsp;Ws strobe at 1/4 power (~125&nbsp;Ws) plotted alongside a
        200&nbsp;Ws strobe at half power (~100&nbsp;Ws).
      </>
    ),
  },
  {
    term: "How to use the chart",
    body: (
      <>
        Select flashes from the <strong>Flashes</strong> panel on the left (or tap{" "}
        <strong>Filters &amp; Flashes</strong> on mobile). Use the Brand, Type, and Output
        filters to narrow the list. Hover any point for the exact reading. Drag horizontally
        on the chart to zoom into a power range, and click <strong>Reset zoom</strong> to
        return to the full view. Use <strong>Copy link</strong> to share your current
        selection.
      </>
    ),
  },
];

export function ChartGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-lg border bg-card text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 font-medium hover:bg-accent rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        How to read this chart
      </button>

      {open && (
        <div className="border-t px-4 pb-5 pt-4">
          <dl className="space-y-4">
            {SECTIONS.map((s) => (
              <div key={s.term}>
                <dt className="mb-0.5 font-semibold">{s.term}</dt>
                <dd className="text-muted-foreground leading-relaxed">{s.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
