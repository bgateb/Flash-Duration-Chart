"use client";

import { useMemo, useState } from "react";
import type { FlashWithReadings } from "@/lib/types";
import { colorForIndex } from "@/lib/colors";
import { FlashChart } from "./FlashChart";
import { FlashPicker } from "./FlashPicker";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

export type PowerAxis = "fraction" | "stops";
export type DurationAxis = "one-over-x" | "seconds";

export function FlashChartView({ flashes }: { flashes: FlashWithReadings[] }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(flashes.map((f) => f.id)));
  const [powerAxis, setPowerAxis] = useState<PowerAxis>("fraction");
  const [durationAxis, setDurationAxis] = useState<DurationAxis>("one-over-x");

  const colored = useMemo(
    () => flashes.map((f, i) => ({ ...f, color: colorForIndex(i) })),
    [flashes]
  );
  const visible = useMemo(() => colored.filter((f) => selected.has(f.id)), [colored, selected]);

  return (
    <div className="grid gap-6 md:grid-cols-[220px,1fr]">
      <aside className="space-y-6 md:sticky md:top-4 md:self-start">
        <FlashPicker flashes={colored} selected={selected} onChange={setSelected} />
      </aside>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <AxisToggle
            label="Power"
            value={powerAxis}
            onChange={(v) => setPowerAxis(v as PowerAxis)}
            options={[
              { value: "fraction", label: "1 / N" },
              { value: "stops", label: "Stops" },
            ]}
          />
          <AxisToggle
            label="Duration"
            value={durationAxis}
            onChange={(v) => setDurationAxis(v as DurationAxis)}
            options={[
              { value: "one-over-x", label: "1 / Xs" },
              { value: "seconds", label: "Seconds" },
            ]}
          />
        </div>

        <div className="rounded-lg border bg-card p-2 md:p-4">
          <FlashChart flashes={visible} powerAxis={powerAxis} durationAxis={durationAxis} />
        </div>

        <ReadingsTable flashes={visible} />
      </section>
    </div>
  );
}

function AxisToggle({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v)}
      >
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value}>
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

import { stopsToFraction, stopsToLabel, effectiveWs, formatWs } from "@/lib/power";
import { secondsToOneOverX, secondsToPrecise } from "@/lib/duration";

function ReadingsTable({ flashes }: { flashes: (FlashWithReadings & { color: string })[] }) {
  const anyRated = flashes.some((f) => f.rated_ws != null);
  const rows = flashes.flatMap((f) =>
    f.readings.map((r) => ({
      id: `${f.id}-${r.id}`,
      flash: `${f.manufacturer} ${f.model}`,
      color: f.color,
      stops: r.stops_below_full,
      t: r.t_one_tenth_seconds,
      ct: r.color_temp_k,
      notes: r.notes,
      ws: effectiveWs(r.stops_below_full, f.rated_ws),
    }))
  );
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Flash</th>
            <th className="px-3 py-2 text-right font-medium">Power</th>
            {anyRated ? <th className="px-3 py-2 text-right font-medium">Output</th> : null}
            <th className="px-3 py-2 text-right font-medium">t.1</th>
            <th className="px-3 py-2 text-right font-medium">Color temp</th>
            <th className="px-3 py-2 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/60">
              <td className="px-3 py-2">
                <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: r.color }} />
                <span className="ml-2 align-middle">{r.flash}</span>
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {stopsToFraction(r.stops)} <span className="text-muted-foreground">({stopsToLabel(r.stops)})</span>
              </td>
              {anyRated ? (
                <td className="px-3 py-2 text-right font-mono">{formatWs(r.ws)}</td>
              ) : null}
              <td className="px-3 py-2 text-right font-mono">
                {secondsToOneOverX(r.t)} <span className="text-muted-foreground">/ {secondsToPrecise(r.t)}</span>
              </td>
              <td className="px-3 py-2 text-right font-mono">{r.ct ? `${r.ct} K` : "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
