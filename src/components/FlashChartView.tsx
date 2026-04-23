"use client";

import { useMemo, useState } from "react";
import type { FlashWithReadings, Reading } from "@/lib/types";
import { colorForIndex } from "@/lib/colors";
import { FlashChart } from "./FlashChart";
import { FlashPicker } from "./FlashPicker";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { stopsToFraction, stopsToLabel, effectiveWs, formatWs } from "@/lib/power";
import { secondsToOneOverX, secondsToPrecise } from "@/lib/duration";

export type PowerAxis = "fraction" | "stops";
export type DurationAxis = "one-over-x" | "seconds";

// Dash pattern per mode. "Normal" is always solid; secondary modes get
// progressively sparser dashes so the same-color variant reads as "same
// flash, different mode" at a glance.
const DASH_PATTERNS = ["0", "6 4", "2 3", "10 5", "1 4", "8 2 2 2"];

function sortModes(modes: string[]): string[] {
  return [...modes].sort((a, b) => {
    if (a === b) return 0;
    if (a === "Normal") return -1;
    if (b === "Normal") return 1;
    return a.localeCompare(b);
  });
}

export type ColoredFlash = FlashWithReadings & { color: string; modes: string[] };

export type Series = {
  id: string; // `${flashId}:${mode}`
  flashId: number;
  flashName: string;
  mode: string;
  color: string;
  dashPattern: string;
  ratedWs: number | null;
  readings: Reading[];
};

export function FlashChartView({ flashes }: { flashes: FlashWithReadings[] }) {
  // Color + modes per flash
  const colored: ColoredFlash[] = useMemo(() => {
    return flashes.map((f, i) => {
      const modes = sortModes(Array.from(new Set(f.readings.map((r) => r.mode))));
      return { ...f, color: colorForIndex(i), modes };
    });
  }, [flashes]);

  // Build all (flash, mode) series with dash style by mode index.
  const allSeries: Series[] = useMemo(() => {
    const allModes = sortModes(
      Array.from(new Set(colored.flatMap((f) => f.modes)))
    );
    const dashByMode: Record<string, string> = {};
    allModes.forEach((m, i) => {
      dashByMode[m] = DASH_PATTERNS[Math.min(i, DASH_PATTERNS.length - 1)];
    });
    const list: Series[] = [];
    for (const f of colored) {
      for (const m of f.modes) {
        list.push({
          id: `${f.id}:${m}`,
          flashId: f.id,
          flashName: `${f.manufacturer} ${f.model}`,
          mode: m,
          color: f.color,
          dashPattern: dashByMode[m] ?? "0",
          ratedWs: f.rated_ws,
          readings: f.readings.filter((r) => r.mode === m),
        });
      }
    }
    return list;
  }, [colored]);

  // Selection keyed by series id. Default: everything visible.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(allSeries.map((s) => s.id))
  );
  const [powerAxis, setPowerAxis] = useState<PowerAxis>("fraction");
  const [durationAxis, setDurationAxis] = useState<DurationAxis>("one-over-x");

  const visibleSeries = useMemo(
    () => allSeries.filter((s) => selected.has(s.id)),
    [allSeries, selected]
  );

  return (
    <div className="grid gap-6 md:grid-cols-[240px,1fr]">
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
          <FlashChart series={visibleSeries} powerAxis={powerAxis} durationAxis={durationAxis} />
        </div>

        <ReadingsTable series={visibleSeries} />
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

function ReadingsTable({ series }: { series: Series[] }) {
  const anyRated = series.some((s) => s.ratedWs != null);
  const anyMultiMode =
    new Set(series.map((s) => s.mode)).size > 1 ||
    series.some((s) => s.mode !== "Normal");
  const rows = series.flatMap((s) =>
    s.readings.map((r) => ({
      key: `${s.id}-${r.id}`,
      flashName: s.flashName,
      color: s.color,
      mode: s.mode,
      stops: r.stops_below_full,
      t: r.t_one_tenth_seconds,
      ct: r.color_temp_k,
      notes: r.notes,
      ws: effectiveWs(r.stops_below_full, s.ratedWs),
    }))
  );
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Flash</th>
            {anyMultiMode ? <th className="px-3 py-2 text-left font-medium">Mode</th> : null}
            <th className="px-3 py-2 text-right font-medium">Power</th>
            {anyRated ? <th className="px-3 py-2 text-right font-medium">Output</th> : null}
            <th className="px-3 py-2 text-right font-medium">t.1</th>
            <th className="px-3 py-2 text-right font-medium">Color temp</th>
            <th className="px-3 py-2 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border/60">
              <td className="px-3 py-2">
                <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: r.color }} />
                <span className="ml-2 align-middle">{r.flashName}</span>
              </td>
              {anyMultiMode ? (
                <td className="px-3 py-2 text-muted-foreground">{r.mode}</td>
              ) : null}
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
