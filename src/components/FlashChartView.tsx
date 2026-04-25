"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FlashWithReadings, Reading } from "@/lib/types";
import { colorForIndex } from "@/lib/colors";
import { FlashChart } from "./FlashChart";
import { FlashPicker } from "./FlashPicker";
import { FlashFilters } from "./FlashFilters";
import {
  applyFilters,
  activeFilterCount,
  clearAllFilters,
  selectedValues,
  selectedRange,
  FLASH_FILTERS,
  type FilterState,
} from "@/lib/filters";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Sheet, SheetTrigger, SheetContent } from "./ui/sheet";
import { SlidersHorizontal, Link2, Check, ChevronUp, ChevronDown, Download } from "lucide-react";
import { stopsToFraction, stopsToLabel, effectiveWs, formatWs } from "@/lib/power";
import { secondsToOneOverX, secondsToPrecise } from "@/lib/duration";

export type PowerAxis = "fraction" | "stops";
export type DurationAxis = "one-over-x" | "seconds";
export type CompareMode = "relative" | "absolute";

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

// ---------------------------------------------------------------------------
// URL state serialization / deserialization
// ---------------------------------------------------------------------------

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function parseInitialState(params: SearchParams) {
  const filterState: FilterState = {};

  const brand = getParam(params, "brand");
  if (brand) {
    const values = brand.split(",").filter(Boolean);
    if (values.length) filterState["manufacturer"] = { kind: "multi-select", values };
  }

  const type = getParam(params, "type");
  if (type) {
    const values = type.split(",").filter(Boolean);
    if (values.length) filterState["type"] = { kind: "multi-select", values };
  }

  const pow = getParam(params, "pow");
  if (pow) {
    const [minStr, maxStr] = pow.split(",");
    const min = Number(minStr);
    const max = Number(maxStr);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      filterState["power"] = { kind: "range", min, max };
    }
  }

  // Series: repeated ?s=flashId:mode params OR comma-separated in one param
  const rawS = params["s"];
  const sArr = Array.isArray(rawS) ? rawS : rawS ? [rawS] : [];
  const selected = new Set<string>(sArr.flatMap((v) => v.split(",")).filter(Boolean));

  const pa = getParam(params, "pa");
  const powerAxis: PowerAxis = pa === "stops" ? "stops" : "fraction";

  const da = getParam(params, "da");
  const durationAxis: DurationAxis = da === "seconds" ? "seconds" : "one-over-x";

  const cm = getParam(params, "cm");
  const compareMode: CompareMode = cm === "absolute" ? "absolute" : "relative";

  return { filterState, selected, powerAxis, durationAxis, compareMode };
}

function buildUrl(
  filterState: FilterState,
  selected: Set<string>,
  powerAxis: PowerAxis,
  durationAxis: DurationAxis,
  compareMode: CompareMode,
): string {
  const parts: string[] = [];

  const brands = selectedValues(filterState, "manufacturer");
  if (brands.length) parts.push(`brand=${brands.map(encodeURIComponent).join(",")}`);

  const types = selectedValues(filterState, "type");
  if (types.length) parts.push(`type=${types.map(encodeURIComponent).join(",")}`);

  const powRange = selectedRange(filterState, "power");
  if (powRange) parts.push(`pow=${powRange.min},${powRange.max}`);

  // Each selected series as a separate param (colons are valid in query strings)
  for (const id of selected) parts.push(`s=${id}`);

  if (powerAxis !== "fraction") parts.push(`pa=${powerAxis}`);
  if (durationAxis !== "one-over-x") parts.push(`da=${durationAxis}`);
  if (compareMode !== "relative") parts.push(`cm=${compareMode}`);

  const qs = parts.join("&");
  return window.location.pathname + (qs ? `?${qs}` : "");
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FlashChartView({
  flashes,
  initialParams = {},
}: {
  flashes: FlashWithReadings[];
  initialParams?: SearchParams;
}) {
  const init = useMemo(() => parseInitialState(initialParams), []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Color + modes per flash. Colors are assigned from the full list so filters
  // don't re-color things as items appear and disappear.
  const colored: ColoredFlash[] = useMemo(() => {
    return flashes.map((f, i) => {
      const modes = sortModes(Array.from(new Set(f.readings.map((r) => r.mode))));
      return { ...f, color: colorForIndex(i), modes };
    });
  }, [flashes]);

  const [filterState, setFilterState] = useState<FilterState>(init.filterState);
  const filteredColored = useMemo(
    () => applyFilters(colored, FLASH_FILTERS, filterState),
    [colored, filterState],
  );

  // Dash-by-mode is computed from the full list so dash patterns stay stable
  // when filters hide/show flashes.
  const dashByMode = useMemo(() => {
    const allModes = sortModes(Array.from(new Set(colored.flatMap((f) => f.modes))));
    const map: Record<string, string> = {};
    allModes.forEach((m, i) => {
      map[m] = DASH_PATTERNS[Math.min(i, DASH_PATTERNS.length - 1)];
    });
    return map;
  }, [colored]);

  // Build all (flash, mode) series — only for flashes that pass filters.
  const allSeries: Series[] = useMemo(() => {
    const list: Series[] = [];
    for (const f of filteredColored) {
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
  }, [filteredColored, dashByMode]);

  // Selection keyed by series id.
  const [selected, setSelected] = useState<Set<string>>(init.selected);
  const [powerAxis, setPowerAxis] = useState<PowerAxis>(init.powerAxis);
  const [durationAxis, setDurationAxis] = useState<DurationAxis>(init.durationAxis);
  const [compareMode, setCompareMode] = useState<CompareMode>(init.compareMode);

  // Sync state → URL (replaceState so back button is unaffected)
  const isFirstRender = useRef(true);
  useEffect(() => {
    // Skip the very first render if no params were in the URL — keeps it clean
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (Object.keys(initialParams).length === 0) return;
    }
    const url = buildUrl(filterState, selected, powerAxis, durationAxis, compareMode);
    window.history.replaceState(null, "", url);
  }, [filterState, selected, powerAxis, durationAxis, compareMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleSeries = useMemo(
    () => allSeries.filter((s) => selected.has(s.id)),
    [allSeries, selected],
  );

  const hiddenFlashNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of visibleSeries) {
      if (s.ratedWs == null || !(s.ratedWs > 0)) names.add(s.flashName);
    }
    return Array.from(names);
  }, [visibleSeries]);

  const activeFilters = activeFilterCount(filterState);
  const selectedCount = selected.size;

  const sidebarContents = (
    <>
      <FlashFilters
        items={flashes}
        filters={FLASH_FILTERS}
        state={filterState}
        onChange={setFilterState}
      />
      <FlashPicker flashes={filteredColored} selected={selected} onChange={setSelected} />
    </>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[240px,1fr]">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden space-y-6 md:block md:sticky md:top-4 md:self-start">
        {sidebarContents}
      </aside>

      <section className="space-y-4">
        {/* Mobile filter trigger — hidden on desktop */}
        <div className="flex items-center gap-2 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <SlidersHorizontal className="h-4 w-4" />
                Filters &amp; Flashes
                {(activeFilters > 0 || selectedCount > 0) && (
                  <span className="ml-0.5 flex items-center gap-1">
                    {activeFilters > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground leading-none">
                        {activeFilters}
                      </span>
                    )}
                    {selectedCount > 0 && (
                      <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-foreground leading-none">
                        {selectedCount}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent title="Filters &amp; Flashes">
              {sidebarContents}
            </SheetContent>
          </Sheet>
        </div>

        {/* Filter summary bar — always visible */}
        <FilterSummary
          shown={filteredColored.length}
          total={colored.length}
          activeFilters={activeFilters}
          onClearFilters={() => setFilterState(clearAllFilters())}
        />

        <div className="flex flex-wrap items-center gap-3">
          <AxisToggle
            label="Compare"
            value={compareMode}
            onChange={(v) => setCompareMode(v as CompareMode)}
            options={[
              { value: "relative", label: "Relative" },
              { value: "absolute", label: "Absolute Ws" },
            ]}
          />
          {compareMode === "relative" && (
            <AxisToggle
              label="Power"
              value={powerAxis}
              onChange={(v) => setPowerAxis(v as PowerAxis)}
              options={[
                { value: "fraction", label: "1 / N" },
                { value: "stops", label: "Stops" },
              ]}
            />
          )}
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
          <FlashChart
            series={visibleSeries}
            powerAxis={powerAxis}
            durationAxis={durationAxis}
            compareMode={compareMode}
          />
        </div>

        {compareMode === "absolute" && hiddenFlashNames.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Hidden in absolute mode (no rated Ws): {hiddenFlashNames.join(", ")}.
          </p>
        ) : null}

        <ReadingsTable series={visibleSeries} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterSummary({
  shown,
  total,
  activeFilters,
  onClearFilters,
}: {
  shown: number;
  total: number;
  activeFilters: number;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{shown}</span>
        {" "}of{" "}
        <span className="font-medium text-foreground">{total}</span>
        {" "}flashes
        {activeFilters > 0 && (
          <>
            <span className="mx-1.5">·</span>
            <span>
              {activeFilters} filter{activeFilters === 1 ? "" : "s"} active
            </span>
            <span className="mx-1.5">·</span>
            <button
              onClick={onClearFilters}
              className="underline-offset-2 hover:text-foreground hover:underline"
            >
              clear
            </button>
          </>
        )}
      </p>
      <CopyLinkButton />
    </div>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the URL bar — not much else we can do
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy link to current view"
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied!
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" />
          Copy link
        </>
      )}
    </button>
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
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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

type SortKey = "flash" | "mode" | "power" | "output" | "t" | "ct";

function ReadingsTable({ series }: { series: Series[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("power");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const anyRated = series.some((s) => s.ratedWs != null);
  const anyMultiMode =
    new Set(series.map((s) => s.mode)).size > 1 ||
    series.some((s) => s.mode !== "Normal");

  const rows = useMemo(() => {
    const raw = series.flatMap((s) =>
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
      })),
    );
    return raw.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "flash":  cmp = a.flashName.localeCompare(b.flashName); break;
        case "mode":   cmp = a.mode.localeCompare(b.mode); break;
        case "power":  cmp = a.stops - b.stops; break;
        case "output": cmp = (a.ws ?? -Infinity) - (b.ws ?? -Infinity); break;
        case "t":      cmp = a.t - b.t; break;
        case "ct":     cmp = (a.ct ?? 0) - (b.ct ?? 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [series, sortKey, sortDir]);

  const downloadCsv = useCallback(() => {
    const headers = [
      "Flash",
      ...(anyMultiMode ? ["Mode"] : []),
      "Power",
      "Stops",
      ...(anyRated ? ["Output (Ws)"] : []),
      "t.1 (1/X)",
      "t.1 (seconds)",
      "Color Temp (K)",
      "Notes",
    ];
    const csvRows = rows.map((r) => [
      r.flashName,
      ...(anyMultiMode ? [r.mode] : []),
      stopsToFraction(r.stops),
      stopsToLabel(r.stops),
      ...(anyRated ? [r.ws != null ? r.ws.toFixed(1) : ""] : []),
      secondsToOneOverX(r.t),
      secondsToPrecise(r.t),
      r.ct ? String(r.ct) : "",
      r.notes ?? "",
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "flash-duration-readings.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, anyRated, anyMultiMode]);

  if (rows.length === 0) return null;

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-0.5 opacity-0 group-hover:opacity-30">↕</span>;
    return sortDir === "asc"
      ? <ChevronUp className="ml-0.5 inline h-3 w-3" />
      : <ChevronDown className="ml-0.5 inline h-3 w-3" />;
  }

  function SortTh({ col, label, align = "left" }: { col: SortKey; label: string; align?: "left" | "right" }) {
    return (
      <th
        className={`group cursor-pointer select-none px-3 py-2 font-medium hover:text-foreground text-${align}`}
        onClick={() => handleSort(col)}
      >
        {label}<SortIcon col={col} />
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {rows.length} reading{rows.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <SortTh col="flash" label="Flash" />
            {anyMultiMode ? <SortTh col="mode" label="Mode" /> : null}
            <SortTh col="power" label="Power" align="right" />
            {anyRated ? <SortTh col="output" label="Output" align="right" /> : null}
            <SortTh col="t" label="t.1" align="right" />
            <SortTh col="ct" label="Color temp" align="right" />
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
