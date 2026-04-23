"use client";

import { useMemo } from "react";
import type { FilterDefinition, FilterState } from "@/lib/filters";
import {
  activeFilterCount,
  clearAllFilters,
  clearFilter,
  getOptions,
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
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Filters{total > 0 ? <span className="ml-1 text-foreground">· {total}</span> : null}
        </h2>
        {total > 0 ? (
          <button
            onClick={() => onChange(clearAllFilters())}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {filters.map((def) => (
          <FilterSection
            key={def.key}
            def={def}
            items={items}
            selected={state[def.key] ?? []}
            onToggle={(value) => onChange(toggleFilterValue(state, def.key, value))}
            onClear={() => onChange(clearFilter(state, def.key))}
          />
        ))}
      </div>
    </div>
  );
}

function FilterSection<T>({
  def,
  items,
  selected,
  onToggle,
  onClear,
}: {
  def: FilterDefinition<T>;
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
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {def.label}
        </h3>
        {selected.length > 0 ? (
          <button
            onClick={onClear}
            className="text-[11px] text-muted-foreground hover:text-foreground"
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
