"use client";

import { useMemo } from "react";
import type {
  FilterDefinition,
  FilterState,
  MultiSelectFilter,
  RangeFilter,
} from "@/lib/filters";
import {
  activeFilterCount,
  clearAllFilters,
  clearFilter,
  getOptions,
  getRangeBounds,
  selectedRange,
  selectedValues,
  setRangeValue,
  toggleFilterValue,
} from "@/lib/filters";
import { Checkbox } from "./ui/checkbox";

export function FlashFilters<T>({
  items,
  filters,
  state,
  onChange,
}: {
  items: T[];
  filters: FilterDefinition<T>[];
  state: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const total = activeFilterCount(state);

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Filters{total > 0 ? <span className="ml-1 text-muted-foreground">· {total}</span> : null}
        </h2>
        {total > 0 ? (
          <button
            onClick={() => onChange(clearAllFilters())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {filters.map((def) => {
          if (def.kind === "multi-select") {
            return (
              <MultiSelectSection
                key={def.key}
                def={def}
                items={items}
                selected={selectedValues(state, def.key)}
                onToggle={(value) => onChange(toggleFilterValue(state, def.key, value))}
                onClear={() => onChange(clearFilter(state, def.key))}
              />
            );
          }
          return (
            <RangeSection
              key={def.key}
              def={def}
              items={items}
              value={selectedRange(state, def.key)}
              onChange={(range) => onChange(setRangeValue(state, def.key, range))}
            />
          );
        })}
      </div>
    </div>
  );
}

function MultiSelectSection<T>({
  def,
  items,
  selected,
  onToggle,
  onClear,
}: {
  def: MultiSelectFilter<T>;
  items: T[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const options = useMemo(() => getOptions(def, items), [def, items]);
  if (options.length === 0) return null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">
          {def.label}
        </h3>
        {selected.length > 0 ? (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        ) : null}
      </div>
      <ul className="space-y-0.5">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <li key={o.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 hover:bg-accent">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(o.value)}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1 text-xs">
                  {o.label}
                  <span className="ml-1 text-muted-foreground">· {o.count}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RangeSection<T>({
  def,
  items,
  value,
  onChange,
}: {
  def: RangeFilter<T>;
  items: T[];
  value: { min: number; max: number } | null;
  onChange: (range: { min: number; max: number } | null) => void;
}) {
  const bounds = useMemo(() => getRangeBounds(def, items), [def, items]);
  if (!bounds || bounds.min === bounds.max) return null;

  const step = def.step ?? 1;
  const fmt = def.format ?? ((n: number) => String(n));
  const min = value?.min ?? bounds.min;
  const max = value?.max ?? bounds.max;
  const isDefault = min === bounds.min && max === bounds.max;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground">
          {def.label}
        </h3>
        {!isDefault ? (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        ) : null}
      </div>
      <div className="mb-1.5 text-xs">
        {fmt(min)}
        <span className="mx-1 text-muted-foreground">→</span>
        {fmt(max)}
      </div>
      <div className="space-y-1">
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={min}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ min: Math.min(n, max), max });
          }}
          className="w-full accent-primary"
          aria-label={`${def.label} minimum`}
        />
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ min, max: Math.max(n, min) });
          }}
          className="w-full accent-primary"
          aria-label={`${def.label} maximum`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{fmt(bounds.min)}</span>
        <span>{fmt(bounds.max)}</span>
      </div>
    </div>
  );
}
