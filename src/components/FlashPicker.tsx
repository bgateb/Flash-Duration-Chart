"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info, Search, X } from "lucide-react";
import type { ColoredFlash } from "./FlashChartView";
import { Checkbox } from "./ui/checkbox";
import { FlashDetail } from "./FlashDetail";

const EXPANDED_BRANDS_STORAGE_KEY = "fd.expandedBrands";

export function FlashPicker({
  flashes,
  selected,
  onChange,
  sparklineRange,
}: {
  flashes: ColoredFlash[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /**
   * Global x/y ranges for sparklines. Computed from the unfiltered catalog
   * so all rows share a scale — without that, sparklines aren't a real
   * comparison (Tufte). `null` skips sparkline rendering entirely.
   */
  sparklineRange?: { x: readonly [number, number]; y: readonly [number, number] } | null;
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
    if (allOn) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onChange(next);
  }

  function toggleAllForGroup(groupFlashes: ColoredFlash[]) {
    const keys = groupFlashes.flatMap((f) => f.modes.map((m) => seriesKey(f.id, m)));
    const allOn = keys.length > 0 && keys.every((k) => selected.has(k));
    const next = new Set(selected);
    if (allOn) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onChange(next);
  }

  const [detailFlash, setDetailFlash] = useState<ColoredFlash | null>(null);
  const [search, setSearch] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Brand groups collapsed by default; user-toggled expansions persist in
  // localStorage. When a search is active, all groups with at least one match
  // force-expand (without mutating the persisted set).
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(EXPANDED_BRANDS_STORAGE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        setExpandedBrands(new Set(arr.filter((v): v is string => typeof v === "string")));
      }
    } catch {
      // localStorage unavailable or malformed — fall back to all-collapsed.
    }
  }, []);

  function toggleBrandExpanded(manufacturer: string) {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(manufacturer)) next.delete(manufacturer);
      else next.add(manufacturer);
      try {
        window.localStorage.setItem(
          EXPANDED_BRANDS_STORAGE_KEY,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        // ignore — preference loss is recoverable
      }
      return next;
    });
  }

  const isSearching = search.trim() !== "";

  // Apply "show only selected" first, then search. Empty filters short-circuit.
  const visibleFlashes = useMemo(() => {
    let list = flashes;
    if (showOnlySelected) {
      list = list.filter((f) =>
        f.modes.some((m) => selected.has(seriesKey(f.id, m))),
      );
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((f) => {
      const hay = `${f.manufacturer} ${f.model}`.toLowerCase();
      return hay.includes(q);
    });
  }, [flashes, search, showOnlySelected, selected]);

  function allOn() {
    // Selects every series currently visible (respects search/filters);
    // preserves anything already selected so search-narrowed "all" doesn't
    // discard prior picks elsewhere in the catalog.
    const next = new Set(selected);
    for (const f of visibleFlashes) for (const m of f.modes) next.add(seriesKey(f.id, m));
    onChange(next);
  }
  function allOff() {
    onChange(new Set());
  }

  // Group flashes by manufacturer, sorted alphabetically
  const groups = Object.entries(
    visibleFlashes.reduce<Record<string, ColoredFlash[]>>((acc, f) => {
      (acc[f.manufacturer] ??= []).push(f);
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Flashes</h2>
        <div className="flex gap-1 text-xs">
          <button onClick={allOn} className="text-muted-foreground hover:text-foreground">
            all
          </button>
          <span className="text-muted-foreground/50">·</span>
          <button onClick={allOff} className="text-muted-foreground hover:text-foreground">
            none
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brand or model"
          aria-label="Search flashes"
          className="h-7 w-full rounded-md border border-input bg-background pl-7 pr-7 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {/* Show-only-selected toggle. When on, the list collapses to just the
          flashes the user has currently selected — useful for managing a
          comparison set without scrolling the full catalog. */}
      <button
        type="button"
        onClick={() => setShowOnlySelected((v) => !v)}
        aria-pressed={showOnlySelected}
        className={[
          "mb-2 inline-flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-[11px] transition-colors",
          showOnlySelected
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        ].join(" ")}
      >
        <span>Show only selected</span>
        <span className="font-mono">{selected.size}</span>
      </button>

      {showOnlySelected && selected.size === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          No flashes selected — turn this off, or pick some from the list.
        </p>
      ) : groups.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          {isSearching
            ? `No flashes match "${search}".`
            : "No flashes."}
        </p>
      ) : null}

      <div className="space-y-3">
        {groups.map(([manufacturer, groupFlashes], gi) => {
          const groupKeys = groupFlashes.flatMap((f) =>
            f.modes.map((m) => seriesKey(f.id, m)),
          );
          const groupAllOn = groupKeys.length > 0 && groupKeys.every((k) => selected.has(k));
          const groupSomeOn = groupKeys.some((k) => selected.has(k));
          const selectedInGroup = groupKeys.reduce(
            (n, k) => (selected.has(k) ? n + 1 : n),
            0,
          );
          // Force-expand groups while searching or while filtering to selected
          // only — those modes are intent-signals that the user wants to see
          // matching rows, and forcing them open keeps results visible.
          // showOnlySelected implies every visible group has selections, so
          // we always reveal them in that mode too.
          const isExpanded =
            isSearching || showOnlySelected || expandedBrands.has(manufacturer);

          return (
            <div key={manufacturer}>
              {/* Manufacturer group header */}
              {gi > 0 && <div className="mb-2 border-t border-border/40" />}
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleBrandExpanded(manufacturer)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Collapse ${manufacturer}` : `Expand ${manufacturer}`}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleAllForGroup(groupFlashes)}
                    className="flex items-center gap-1.5 text-left"
                    title={groupAllOn ? `Deselect all ${manufacturer}` : `Select all ${manufacturer}`}
                  >
                    {/* Indeterminate-style indicator for the group */}
                    <span
                      className={[
                        "inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border text-[8px] font-bold leading-none transition-colors",
                        groupAllOn
                          ? "border-primary bg-primary text-primary-foreground"
                          : groupSomeOn
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border bg-transparent text-transparent",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      {groupSomeOn ? "▪" : ""}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {manufacturer}
                    </span>
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {selectedInGroup > 0 ? `${selectedInGroup} / ` : ""}
                  {groupFlashes.length}
                </span>
              </div>

              {/* Flashes within group */}
              {isExpanded ? (
              <ul className="space-y-1">
                {groupFlashes.map((f) => {
                  const modes = f.modes;
                  const flashKeys = modes.map((m) => seriesKey(f.id, m));
                  const flashAllOn = modes.length > 0 && flashKeys.every((k) => selected.has(k));
                  const flashSomeOn = flashKeys.some((k) => selected.has(k));
                  const totalReadings = f.readings.length;
                  const showNestedModes =
                    modes.length > 1 || (modes.length === 1 && modes[0] !== "Normal");

                  const testedYear = parseTestedYear(f.tested_on);

                  return (
                    <li key={f.id}>
                      <div className="flex items-start gap-1">
                        <label className="flex flex-1 cursor-pointer items-start gap-2 rounded px-1.5 py-0.5 hover:bg-accent">
                          <Checkbox
                            checked={flashAllOn ? true : flashSomeOn ? "indeterminate" : false}
                            onCheckedChange={() => toggleAllForFlash(f.id, modes)}
                            className="mt-0.5"
                          />
                          <span className="flex-1 text-sm leading-snug">
                            <span
                              className="inline-block h-2 w-2 rounded-full align-middle"
                              style={{ background: f.color }}
                            />
                            {/* Model only — manufacturer is in the group header */}
                            <span className="ml-2 align-middle">{f.model}</span>
                            {f.rated_ws != null ? (
                              <span className="ml-1 text-xs font-mono text-muted-foreground">
                                · {f.rated_ws} Ws
                              </span>
                            ) : null}
                            <span className="ml-1 text-xs text-muted-foreground">
                              · {totalReadings} pts
                            </span>
                            {testedYear ? (
                              <span
                                className="ml-1 text-xs text-muted-foreground"
                                title={`Tested ${f.tested_on}`}
                              >
                                · {testedYear}
                              </span>
                            ) : null}
                          </span>
                        </label>
                        {sparklineRange ? (
                          <Sparkline
                            readings={f.readings}
                            color={f.color}
                            range={sparklineRange}
                          />
                        ) : null}
                        <button
                          onClick={() => setDetailFlash(f)}
                          aria-label={`Details for ${f.manufacturer} ${f.model}`}
                          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </div>

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
              ) : null}
            </div>
          );
        })}
      </div>

      <FlashDetail flash={detailFlash} onClose={() => setDetailFlash(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse the year out of a `tested_on` value. The DB stores either a full ISO
 * date ("2024-03-15") or a year-only string ("2024"); both are handled.
 * Returns null for missing/unparseable inputs.
 */
function parseTestedYear(tested_on: string | null | undefined): string | null {
  if (!tested_on) return null;
  const m = tested_on.match(/^(\d{4})/);
  return m ? m[1] : null;
}

const SPARK_W = 56;
const SPARK_H = 16;
const SPARK_PAD = 2;

/**
 * A Tufte-style sparkline preview of a flash's t0.1 curve. All sparklines
 * share the same global log-log scale (passed via `range`) so the comparison
 * across rows is meaningful — without that, sparklines aren't a comparison,
 * they're decoration.
 */
function Sparkline({
  readings,
  color,
  range,
}: {
  readings: { stops_below_full: number; t_one_tenth_seconds: number; mode: string }[];
  color: string;
  range: { x: readonly [number, number]; y: readonly [number, number] };
}) {
  if (readings.length === 0) return null;

  // Sort all readings by x (power) so the polyline traces left-to-right.
  // Multi-mode flashes will produce one merged path; that's fine for a
  // gestalt-level preview — the FlashDetail modal is where mode-by-mode
  // comparison lives.
  const pts = readings
    .map((r) => ({
      x: Math.pow(2, r.stops_below_full),
      y: r.t_one_tenth_seconds,
    }))
    .filter((p) => p.x > 0 && p.y > 0)
    .sort((a, b) => a.x - b.x);

  if (pts.length === 0) return null;

  const [xMin, xMax] = range.x;
  const [yMin, yMax] = range.y;
  const logXMin = Math.log2(xMin);
  const logXMax = Math.log2(xMax);
  const logYMin = Math.log10(yMin);
  const logYMax = Math.log10(yMax);
  const xSpan = Math.max(logXMax - logXMin, 1e-6);
  const ySpan = Math.max(logYMax - logYMin, 1e-6);

  function px(v: number): number {
    return SPARK_PAD + ((Math.log2(v) - logXMin) / xSpan) * (SPARK_W - SPARK_PAD * 2);
  }
  function py(v: number): number {
    // Inverted: small t (faster) at top, large t at bottom, matching the
    // main chart's orientation.
    return SPARK_PAD + (1 - (Math.log10(v) - logYMin) / ySpan) * (SPARK_H - SPARK_PAD * 2);
  }

  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      className="mt-1 shrink-0"
      aria-hidden="true"
      role="presentation"
    >
      <path d={d} stroke={color} strokeWidth={1} fill="none" opacity={0.7} />
    </svg>
  );
}
