import type { FlashWithReadings } from "./types";
import { effectiveWs, formatWs } from "./power";

// Sentinel for filter options that represent a null/absent field value.
export const FILTER_NULL = "__null__";

export type FilterOption = {
  value: string;
  label: string;
  count: number;
};

// Filters are a discriminated union so new kinds (e.g. range) can be added
// without reworking the callers. Add a new `kind` and the UI dispatches on it.
export type MultiSelectFilter<T> = {
  kind: "multi-select";
  key: string;
  label: string;
  // Extract the value(s) an item contributes. [] excludes the item.
  valuesOf: (item: T) => string[];
  // Optional pretty label for an option value.
  labelFor?: (value: string) => string;
};

export type RangeFilter<T> = {
  kind: "range";
  key: string;
  label: string;
  // Numeric values the item contributes. An item passes if any value is in
  // the selected [min, max] (inclusive).
  valuesOf: (item: T) => number[];
  // Format a number for display (e.g. stops → "1/64").
  format?: (n: number) => string;
  step?: number;
};

export type FilterDefinition<T> = MultiSelectFilter<T> | RangeFilter<T>;

export type MultiSelectValue = { kind: "multi-select"; values: string[] };
export type RangeValue = { kind: "range"; min: number; max: number };
export type FilterValue = MultiSelectValue | RangeValue;

export type FilterState = Record<string, FilterValue | undefined>;

export function getOptions<T>(
  def: MultiSelectFilter<T>,
  items: T[],
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const v of def.valuesOf(item)) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({
      value,
      label: def.labelFor?.(value) ?? value,
      count,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getRangeBounds<T>(
  def: RangeFilter<T>,
  items: T[],
): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  let found = false;
  for (const item of items) {
    for (const n of def.valuesOf(item)) {
      if (!Number.isFinite(n)) continue;
      if (n < min) min = n;
      if (n > max) max = n;
      found = true;
    }
  }
  return found ? { min, max } : null;
}

export function applyFilters<T, U extends T>(
  items: U[],
  defs: FilterDefinition<T>[],
  state: FilterState,
): U[] {
  return items.filter((item) =>
    defs.every((def) => {
      const v = state[def.key];
      if (!v) return true;
      if (def.kind === "multi-select" && v.kind === "multi-select") {
        if (v.values.length === 0) return true;
        const values = def.valuesOf(item);
        return values.some((val) => v.values.includes(val));
      }
      if (def.kind === "range" && v.kind === "range") {
        const nums = def.valuesOf(item);
        return nums.some((n) => n >= v.min && n <= v.max);
      }
      return true;
    }),
  );
}

export function selectedValues(state: FilterState, key: string): string[] {
  const v = state[key];
  return v?.kind === "multi-select" ? v.values : [];
}

export function selectedRange(
  state: FilterState,
  key: string,
): { min: number; max: number } | null {
  const v = state[key];
  return v?.kind === "range" ? { min: v.min, max: v.max } : null;
}

export function toggleFilterValue(
  state: FilterState,
  key: string,
  value: string,
): FilterState {
  const values = selectedValues(state, key);
  const next = values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
  if (next.length === 0) return clearFilter(state, key);
  return { ...state, [key]: { kind: "multi-select", values: next } };
}

export function setRangeValue(
  state: FilterState,
  key: string,
  range: { min: number; max: number } | null,
): FilterState {
  if (range === null) return clearFilter(state, key);
  return { ...state, [key]: { kind: "range", min: range.min, max: range.max } };
}

export function clearFilter(state: FilterState, key: string): FilterState {
  if (!(key in state)) return state;
  const { [key]: _, ...rest } = state;
  return rest;
}

export function clearAllFilters(): FilterState {
  return {};
}

export function activeFilterCount(state: FilterState): number {
  return Object.values(state).reduce((n, v) => {
    if (!v) return n;
    if (v.kind === "multi-select") return n + v.values.length;
    if (v.kind === "range") return n + 1;
    return n;
  }, 0);
}

// Concrete filter set for flashes. Add new entries here to extend.
export const FLASH_FILTERS: FilterDefinition<FlashWithReadings>[] = [
  {
    kind: "multi-select",
    key: "manufacturer",
    label: "Brand",
    valuesOf: (f) => [f.manufacturer],
  },
  {
    kind: "multi-select",
    key: "type",
    label: "Type",
    valuesOf: (f) => [f.type ?? FILTER_NULL],
    labelFor: (v) => (v === FILTER_NULL ? "Unspecified" : v),
  },
  {
    kind: "range",
    key: "power",
    label: "Output",
    // Each reading's effective Ws (rated × 2^stops). Stored internally as
    // log2(Ws) so the slider is log-scaled — one tick = one stop — and covers
    // the sub-Ws to multi-kilowatt-second range evenly. Flashes without a
    // rated_ws contribute nothing and are excluded when this filter is active.
    valuesOf: (f) => {
      if (f.rated_ws == null || !(f.rated_ws > 0)) return [];
      const out: number[] = [];
      for (const r of f.readings) {
        const ws = effectiveWs(r.stops_below_full, f.rated_ws);
        if (ws != null && ws > 0) out.push(Math.log2(ws));
      }
      return out;
    },
    format: (n) => formatWs(Math.pow(2, n)),
    step: 1,
  },
];
