"use client";

import type { FlashWithReadings } from "@/lib/types";
import { Checkbox } from "./ui/checkbox";

export function FlashPicker({
  flashes,
  selected,
  onChange,
}: {
  flashes: (FlashWithReadings & { color: string })[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }
  function allOn() {
    onChange(new Set(flashes.map((f) => f.id)));
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
      <ul className="space-y-1">
        {flashes.map((f) => (
          <li key={f.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 hover:bg-accent">
              <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} className="mt-0.5" />
              <span className="flex-1 text-sm leading-snug">
                <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: f.color }} />
                <span className="ml-2 align-middle">
                  <span className="text-muted-foreground">{f.manufacturer}</span> {f.model}
                </span>
                {f.mode ? (
                  <span className="ml-1 inline-block rounded bg-muted px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {f.mode}
                  </span>
                ) : null}
                {f.rated_ws != null ? (
                  <span className="ml-1 text-xs font-mono text-muted-foreground">· {f.rated_ws} Ws</span>
                ) : null}
                <span className="ml-1 text-xs text-muted-foreground">· {f.readings.length} pts</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
