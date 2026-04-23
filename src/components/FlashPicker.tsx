"use client";

import type { ColoredFlash } from "./FlashChartView";
import { Checkbox } from "./ui/checkbox";

export function FlashPicker({
  flashes,
  selected,
  onChange,
}: {
  flashes: ColoredFlash[];
  selected: Set<string>; // keys: `${flashId}:${mode}`
  onChange: (next: Set<string>) => void;
}) {
  function seriesKey(flashId: number, mode: string) {
    return `${flashId}:${mode}`;
  }

  function toggleSeries(flashId: number, mode: string) {
    const next = new Set(selected);
    const k = seriesKey(flashId, mode);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  }

  function toggleAllForFlash(flashId: number, modes: string[]) {
    const keys = modes.map((m) => seriesKey(flashId, m));
    const allOn = keys.every((k) => selected.has(k));
    const next = new Set(selected);
    if (allOn) {
      keys.forEach((k) => next.delete(k));
    } else {
      keys.forEach((k) => next.add(k));
    }
    onChange(next);
  }

  function allOn() {
    const next = new Set<string>();
    for (const f of flashes) for (const m of f.modes) next.add(seriesKey(f.id, m));
    onChange(next);
  }
  function allOff() {
    onChange(new Set());
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flashes</h2>
        <div className="flex gap-1 text-[11px]">
          <button onClick={allOn} className="text-muted-foreground hover:text-foreground">
            all
          </button>
          <span className="text-muted-foreground/50">·</span>
          <button onClick={allOff} className="text-muted-foreground hover:text-foreground">
            none
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {flashes.map((f) => {
          const modes = f.modes;
          const flashKeys = modes.map((m) => seriesKey(f.id, m));
          const flashAllOn = modes.length > 0 && flashKeys.every((k) => selected.has(k));
          const flashSomeOn = flashKeys.some((k) => selected.has(k));
          const totalReadings = f.readings.length;
          const showNestedModes = modes.length > 1 || (modes.length === 1 && modes[0] !== "Normal");
          return (
            <li key={f.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 hover:bg-accent">
                <Checkbox
                  checked={flashAllOn ? true : flashSomeOn ? "indeterminate" : false}
                  onCheckedChange={() => toggleAllForFlash(f.id, modes)}
                  className="mt-0.5"
                />
                <span className="flex-1 text-sm leading-snug">
                  <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: f.color }} />
                  <span className="ml-2 align-middle">
                    <span className="text-muted-foreground">{f.manufacturer}</span> {f.model}
                  </span>
                  {f.rated_ws != null ? (
                    <span className="ml-1 text-xs font-mono text-muted-foreground">· {f.rated_ws} Ws</span>
                  ) : null}
                  <span className="ml-1 text-xs text-muted-foreground">· {totalReadings} pts</span>
                </span>
              </label>
              {showNestedModes ? (
                <ul className="ml-6 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                  {modes.map((m) => {
                    const k = seriesKey(f.id, m);
                    const pts = f.readings.filter((r) => r.mode === m).length;
                    return (
                      <li key={m}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 hover:bg-accent">
                          <Checkbox
                            checked={selected.has(k)}
                            onCheckedChange={() => toggleSeries(f.id, m)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="flex-1 text-xs">
                            {m}
                            <span className="ml-1 text-muted-foreground">· {pts} pts</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
