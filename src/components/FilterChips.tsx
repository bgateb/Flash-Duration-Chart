"use client";

import { X } from "lucide-react";
import type { FilterDefinition, FilterState } from "@/lib/filters";
import {
  clearAllFilters,
  clearFilter,
  selectedRange,
  selectedValues,
  toggleFilterValue,
} from "@/lib/filters";

type Chip =
  | { id: string; label: string; onRemove: () => void }
  | null;

/**
 * Compact, removable chips representing the active filters. Renders nothing
 * when no filters are active. Each chip clears one value (multi-select) or
 * the whole range; "Clear all" appears when 2+ chips are present.
 */
export function FilterChips<T>({
  filters,
  state,
  onChange,
}: {
  filters: FilterDefinition<T>[];
  state: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const chips: Chip[] = [];

  for (const def of filters) {
    if (def.kind === "multi-select") {
      const values = selectedValues(state, def.key);
      for (const v of values) {
        const pretty = def.labelFor?.(v) ?? v;
        chips.push({
          id: `${def.key}:${v}`,
          label: `${def.label}: ${pretty}`,
          onRemove: () => onChange(toggleFilterValue(state, def.key, v)),
        });
      }
    } else {
      const range = selectedRange(state, def.key);
      if (range) {
        const fmt = def.format ?? ((n: number) => String(n));
        chips.push({
          id: def.key,
          label: `${def.label}: ${fmt(range.min)} – ${fmt(range.max)}`,
          onRemove: () => onChange(clearFilter(state, def.key)),
        });
      }
    }
  }

  const visible = chips.filter((c): c is NonNullable<Chip> => c !== null);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((c) => (
        <button
          key={c.id}
          onClick={c.onRemove}
          className="group inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-foreground hover:border-foreground/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          aria-label={`Remove filter ${c.label}`}
        >
          <span>{c.label}</span>
          <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
        </button>
      ))}
      {visible.length > 1 ? (
        <button
          onClick={() => onChange(clearAllFilters())}
          className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
