"use client";

import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
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
import { cn } from "@/lib/cn";
import { RangeSlider } from "./ui/range-slider";

/**
 * Filter sidebar. Visually distinct from FlashPicker by intent: the picker
 * lists individual flashes (checkbox tree); this panel narrows the catalog
 * via toggle pills and a range slider. The pill layout is what carries the
 * "this is a filter, not a list" cue at a glance.
 */
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
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Refine
          </h2>
          {total > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {total}
            </span>
          ) : null}
        </div>
        {total > 0 ? (
          <button
            onClick={() => onChange(clearAllFilters())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
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

function SectionHeader({
  label,
  showClear,
  onClear,
}: {
  label: string;
  showClear: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      {showClear ? (
        <button
          onClick={onClear}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          reset
        </button>
      ) : null}
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
      <SectionHeader
        label={def.label}
        showClear={selected.length > 0}
        onClear={onClear}
      />
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              aria-pressed={checked}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-foreground/40 hover:bg-accent",
              )}
            >
              <span>{o.label}</span>
              <span
                className={cn(
                  "text-[10px]",
                  checked ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {o.count}
              </span>
            </button>
          );
        })}
      </div>
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
      <SectionHeader
        label={def.label}
        showClear={!isDefault}
        onClear={() => onChange(null)}
      />
      <div className="mb-2 flex items-baseline justify-between text-xs">
        <span className="font-mono text-foreground">{fmt(min)}</span>
        <span className="text-muted-foreground">to</span>
        <span className="font-mono text-foreground">{fmt(max)}</span>
      </div>
      <RangeSlider
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={{ min, max }}
        onChange={(next) => onChange(next)}
        ariaLabel={def.label}
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{fmt(bounds.min)}</span>
        <span>{fmt(bounds.max)}</span>
      </div>
    </div>
  );
}
