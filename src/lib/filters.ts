import type { FlashWithReadings } from "./types";

// Sentinel for filter options that represent a null/absent field value.
export const FILTER_NULL = "__null__";

export type FilterOption = {
  value: string;
  label: string;
  count: number;
};

// A filter is a multi-select over a derived string field of `T`. Adding a new
// filter means adding one entry here — no changes needed in the UI component.
export type FilterDefinition<T> = {
  key: string;
  label: string;
  // Extract the value(s) an item contributes to this filter. Return [] to
  // exclude an item entirely. Return [FILTER_NULL] for absent values so null
  // becomes a selectable option.
  valuesOf: (item: T) => string[];
  // Optional label override for an option value (e.g. pretty-print null).
  labelFor?: (value: string) => string;
};

export type FilterState = Record<string, string[]>;

export function getOptions<T>(def: FilterDefinition<T>, items: T[]): FilterOption[] {
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

export function applyFilters<T, U extends T>(
  items: U[],
  defs: FilterDefinition<T>[],
  state: FilterState,
): U[] {
  return items.filter((item) =>
    defs.every((def) => {
      const selected = state[def.key];
      if (!selected || selected.length === 0) return true;
      const values = def.valuesOf(item);
      return values.some((v) => selected.includes(v));
    }),
  );
}

export function toggleFilterValue(
  state: FilterState,
  key: string,
  value: string,
): FilterState {
  const current = state[key] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return { ...state, [key]: next };
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
  return Object.values(state).reduce((n, vs) => n + (vs?.length ?? 0), 0);
}

// Concrete filter set for flashes. Add new entries here to extend.
export const FLASH_FILTERS: FilterDefinition<FlashWithReadings>[] = [
  {
    key: "manufacturer",
    label: "Brand",
    valuesOf: (f) => [f.manufacturer],
  },
  {
    key: "type",
    label: "Type",
    valuesOf: (f) => [f.type ?? FILTER_NULL],
    labelFor: (v) => (v === FILTER_NULL ? "Unspecified" : v),
  },
];
