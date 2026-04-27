"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Search } from "lucide-react";
import type { ColoredFlash } from "./FlashChartView";
import { cn } from "@/lib/cn";

export function FlashCommandPalette({
  open,
  onOpenChange,
  flashes,
  selected,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flashes: ColoredFlash[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset query and highlight when opening so the user always starts fresh.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      // Defer focus until after Radix mounts the content
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => rankFlashes(flashes, query), [flashes, query]);

  // Clamp highlight when results shrink
  useEffect(() => {
    if (highlight >= results.length) setHighlight(Math.max(0, results.length - 1));
  }, [results.length, highlight]);

  // Scroll highlighted row into view as the user navigates
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function flashIsSelected(f: ColoredFlash): boolean {
    return f.modes.some((m) => selected.has(`${f.id}:${m}`));
  }

  function toggleFlash(f: ColoredFlash) {
    const keys = f.modes.map((m) => `${f.id}:${m}`);
    const allOn = keys.every((k) => selected.has(k));
    const next = new Set(selected);
    if (allOn) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onChange(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (results.length === 0 ? 0 : (h + 1) % results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) =>
        results.length === 0 ? 0 : (h - 1 + results.length) % results.length,
      );
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(Math.max(0, results.length - 1));
    } else if (e.key === " ") {
      // Space toggles without closing — palette stays open for multi-pick
      const f = results[highlight];
      if (f) {
        e.preventDefault();
        toggleFlash(f);
      }
    } else if (e.key === "Enter") {
      // Enter toggles and closes
      const f = results[highlight];
      if (f) {
        e.preventDefault();
        toggleFlash(f);
        onOpenChange(false);
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 w-[min(640px,92vw)] -translate-x-1/2",
            "flex flex-col overflow-hidden rounded-lg border bg-card shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-150",
          )}
          onKeyDown={onKeyDown}
        >
          <Dialog.Title className="sr-only">Find a flash</Dialog.Title>

          {/* Search input */}
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder="Search by brand, model, or type"
              aria-label="Search flashes"
              className="h-11 w-full bg-transparent pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
            />
          </div>

          {/* Results */}
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query.trim()
                ? `No flashes match "${query.trim()}".`
                : "No flashes."}
            </div>
          ) : (
            <ul
              ref={listRef}
              className="max-h-[60vh] overflow-y-auto py-1"
              role="listbox"
            >
              {results.map((f, i) => {
                const isOn = flashIsSelected(f);
                const isHighlighted = i === highlight;
                return (
                  <li
                    key={f.id}
                    data-idx={i}
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={(e) => {
                      toggleFlash(f);
                      // Shift+click keeps palette open (for building a comparison set)
                      if (!e.shiftKey) onOpenChange(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                      isHighlighted ? "bg-accent" : "",
                    )}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: f.color }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">
                      <span className="font-medium">{f.manufacturer}</span>{" "}
                      <span>{f.model}</span>
                    </span>
                    {f.type ? (
                      <span className="rounded border border-border/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {f.type}
                      </span>
                    ) : null}
                    {f.rated_ws != null ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {f.rated_ws}Ws
                      </span>
                    ) : null}
                    <span className="font-mono text-xs text-muted-foreground">
                      {f.readings.length}pts
                    </span>
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        isOn
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                      aria-hidden="true"
                    >
                      {isOn ? <Check className="h-3 w-3" /> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer hint */}
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <KeyHint k="↑↓">navigate</KeyHint>
              <KeyHint k="Space">toggle</KeyHint>
              <KeyHint k="Enter">toggle &amp; close</KeyHint>
              <KeyHint k="Esc">close</KeyHint>
            </div>
            <span>{results.length} of {flashes.length}</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function KeyHint({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
        {k}
      </kbd>
      <span>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Fuzzy ranking
// ---------------------------------------------------------------------------

/**
 * Rank flashes against a query. Empty query returns flashes in their input
 * order. Otherwise, matches are scored:
 *   - whole-substring hits (in `Manufacturer Model Type`) score highest, with
 *     earlier match positions scoring higher
 *   - subsequence hits (each query char appearing in order) score next, with
 *     tighter spans scoring higher
 * Non-matches are dropped.
 */
function rankFlashes(flashes: ColoredFlash[], query: string): ColoredFlash[] {
  const q = query.trim().toLowerCase();
  if (!q) return flashes;

  type Scored = { f: ColoredFlash; score: number };
  const scored: Scored[] = [];

  for (const f of flashes) {
    const hay = `${f.manufacturer} ${f.model} ${f.type ?? ""}`.toLowerCase();
    const score = scoreMatch(hay, q);
    if (score > 0) scored.push({ f, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak alphabetically so output is stable
    return `${a.f.manufacturer} ${a.f.model}`.localeCompare(
      `${b.f.manufacturer} ${b.f.model}`,
    );
  });

  return scored.map((s) => s.f);
}

function scoreMatch(hay: string, needle: string): number {
  // Exact substring beats subsequence. Earlier match position is better.
  const idx = hay.indexOf(needle);
  if (idx !== -1) {
    // Big base score for substring; bonus for matching at start of a word.
    const wordStart = idx === 0 || hay[idx - 1] === " ";
    return 1000 - idx + (wordStart ? 50 : 0);
  }

  // Subsequence: walk through `hay`, matching `needle` chars in order.
  let hi = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let ni = 0; ni < needle.length; ni++) {
    const c = needle[ni];
    let found = -1;
    while (hi < hay.length) {
      if (hay[hi] === c) {
        found = hi;
        hi++;
        break;
      }
      hi++;
    }
    if (found === -1) return 0;
    if (firstMatch === -1) firstMatch = found;
    lastMatch = found;
  }

  // Tighter spans (lastMatch − firstMatch small) score higher, and earlier
  // first match scores higher. Keep below the substring base score.
  const span = lastMatch - firstMatch;
  return Math.max(1, 500 - span - firstMatch);
}
