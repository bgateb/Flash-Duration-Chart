"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Customized,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Ruler, MousePointer2 } from "lucide-react";
import { stopsToFraction, stopsToLabel, effectiveWs, formatWs } from "@/lib/power";
import { secondsToOneOverX, secondsToPrecise } from "@/lib/duration";
import { cn } from "@/lib/cn";
import type { PowerAxis, DurationAxis, CompareMode, Series } from "./FlashChartView";

// Photographer reference lines on the Y-axis (duration). Each marks a
// commonly-cited shutter speed so users can eyeball whether a given flash
// duration is faster or slower than, say, the typical sync speed.
const REFERENCE_LINES: { y: number; label: string }[] = [
  { y: 1 / 250, label: "1/250s · max x-sync" },
  { y: 1 / 1000, label: "1/1000s · freeze" },
  { y: 1 / 8000, label: "1/8000s · HSS max" },
];

// Cap the tooltip rows so a 30-flash selection doesn't render a wall of text.
const TOOLTIP_ROW_CAP = 12;

export function FlashChart({
  series,
  powerAxis,
  durationAxis,
  compareMode,
}: {
  series: Series[];
  powerAxis: PowerAxis;
  durationAxis: DurationAxis;
  compareMode: CompareMode;
}) {
  // ---------------------------------------------------------------------------
  // Zoom state
  // ---------------------------------------------------------------------------
  const [refLeft, setRefLeft] = useState<number | null>(null);
  const [refRight, setRefRight] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [zoomedX, setZoomedX] = useState<[number, number] | null>(null);
  const selectingRef = useRef(selecting);
  selectingRef.current = selecting;

  // Hover-to-highlight: when a series is hovered (line or legend), fade others.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Voronoi-style hover. We keep references to the rendered axis scales
  // (captured via Recharts' <Customized> escape hatch) and to the chart's
  // plot-area geometry. Together these let us answer "given the cursor's
  // pixel position, which series' point is closest?" — Observable Plot's
  // `pointer` mark and the patterns popularized by D3-Delaunay use the same
  // idea. A full Voronoi diagram is unnecessary here because Recharts
  // already snaps `activeLabel` to the nearest X column; we just resolve the
  // Y axis ourselves and pick the series whose data point is closest in
  // pixel space.
  const scalesRef = useRef<{ y: ((v: number) => number) | null }>({ y: null });

  // Reference lines toggle (default on). Local state — view preference, not
  // worth round-tripping through the URL.
  const [showRefs, setShowRefs] = useState(true);

  // Reset zoom whenever the axis units change — the stored values no longer apply
  useEffect(() => {
    setZoomedX(null);
    setSelecting(false);
    setRefLeft(null);
    setRefRight(null);
  }, [compareMode, powerAxis]);

  // Cancel a drag if the mouse is released anywhere outside the chart
  useEffect(() => {
    function onWindowMouseUp() {
      if (selectingRef.current) {
        setSelecting(false);
        setRefLeft(null);
        setRefRight(null);
      }
    }
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, []);

  function onChartMouseDown(e: any) {
    if (!e || e.activeLabel == null) return;
    setRefLeft(Number(e.activeLabel));
    setRefRight(null);
    setSelecting(true);
  }

  function onChartMouseMove(e: any) {
    if (!e) return;

    // Drag-to-zoom takes priority — extend the zoom rect, skip hover picking.
    if (selectingRef.current) {
      if (e.activeLabel != null) setRefRight(Number(e.activeLabel));
      return;
    }

    // Voronoi-style hover. `e.activeLabel` is the X data value Recharts has
    // snapped to (nearest column); `e.chartY` is the cursor's pixel Y on the
    // chart SVG. We project each series' data Y at that column to pixel
    // space and pick the closest one. Cap distance to keep the highlight
    // from sticking when the cursor is far above/below all lines.
    const yScale = scalesRef.current.y;
    if (e.activeLabel == null || e.chartY == null || yScale == null) return;

    const activeX = Number(e.activeLabel);
    // Find the row matching this X column. Use exact match when possible,
    // fall back to closest (covers fractional-stop readings where powers
    // are non-integer).
    const row =
      combinedData.find((r) => r.power === activeX) ??
      combinedData.reduce(
        (best, r) =>
          Math.abs(r.power - activeX) < Math.abs(best.power - activeX) ? r : best,
        combinedData[0],
      );
    if (!row) return;

    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const cfg of lineConfigs) {
      const yData = row[`t_${cfg.key}`];
      if (typeof yData !== "number") continue;
      const yPixel = yScale(yData);
      const dist = Math.abs(e.chartY - yPixel);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = cfg.id;
      }
    }
    setHoveredId(bestDist < 60 ? bestId : null);
  }

  function onChartMouseLeave() {
    setHoveredId(null);
  }

  function onChartMouseUp() {
    if (selecting && refLeft != null && refRight != null && refLeft !== refRight) {
      const lo = Math.min(refLeft, refRight);
      const hi = Math.max(refLeft, refRight);
      // Snap to the nearest power-of-2 boundary (works for both fraction and Ws axes)
      const snapLo = Math.pow(2, Math.floor(Math.log2(lo)));
      const snapHi = Math.pow(2, Math.ceil(Math.log2(hi)));
      if (snapLo < snapHi) setZoomedX([snapLo, snapHi]);
    }
    setSelecting(false);
    setRefLeft(null);
    setRefRight(null);
  }

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  // In absolute mode, flashes without a rated Ws can't be placed on the axis.
  const plotSeries = useMemo(
    () =>
      compareMode === "absolute"
        ? series.filter((s) => s.ratedWs != null && s.ratedWs > 0)
        : series,
    [series, compareMode],
  );

  const { combinedData, lineConfigs } = useMemo(() => {
    const xMap = new Map<number, Record<string, any>>();
    for (const s of plotSeries) {
      for (const r of s.readings) {
        let x: number;
        if (compareMode === "absolute") {
          const ws = effectiveWs(r.stops_below_full, s.ratedWs);
          if (ws == null) continue;
          x = ws;
        } else {
          x = Math.pow(2, r.stops_below_full);
        }
        if (!xMap.has(x)) xMap.set(x, { power: x, stops: r.stops_below_full });
        const row = xMap.get(x)!;
        const key = encodeKey(s.id);
        row[`t_${key}`] = r.t_one_tenth_seconds;
        row[`ws_${key}`] = effectiveWs(r.stops_below_full, s.ratedWs);
        row[`ct_${key}`] = r.color_temp_k;
        row[`notes_${key}`] = r.notes;
        row[`name_${key}`] = s.mode === "Normal" ? s.flashName : `${s.flashName} — ${s.mode}`;
      }
    }
    const combinedData = Array.from(xMap.values()).sort((a, b) => a.power - b.power);
    const lineConfigs = plotSeries.map((s) => ({
      id: s.id,
      key: encodeKey(s.id),
      name: s.mode === "Normal" ? s.flashName : `${s.flashName} — ${s.mode}`,
      color: s.color,
      dashPattern: s.dashPattern,
    }));
    return { combinedData, lineConfigs };
  }, [plotSeries, compareMode]);

  const { xDomain, yDomain, xTicks, yTicks } = useMemo(() => {
    const allX: number[] = [];
    const allY: number[] = [];
    for (const row of combinedData) {
      allX.push(row.power);
      for (const cfg of lineConfigs) {
        const v = row[`t_${cfg.key}`];
        if (typeof v === "number") allY.push(v);
      }
    }
    if (allX.length === 0) {
      const [xLo, xHi] = compareMode === "absolute" ? [1, 512] : [1 / 256, 1];
      return {
        xDomain: [xLo, xHi] as [number, number],
        yDomain: [0.00001, 0.01] as [number, number],
        xTicks: powerTicks(xLo, xHi),
        yTicks: durationTicks(0.00001, 0.01),
      };
    }
    const xmin = Math.min(...allX);
    const xmax = Math.max(...allX);
    const ymin = Math.min(...allY);
    const ymax = Math.max(...allY);
    const xLo = Math.pow(2, Math.floor(Math.log2(xmin)));
    const xHi = Math.pow(2, Math.ceil(Math.log2(xmax)));
    const yLo = Math.pow(10, Math.floor(Math.log10(ymin)));
    const yHi = Math.pow(10, Math.ceil(Math.log10(ymax)));
    return {
      xDomain: [xLo, Math.max(xHi, xLo * 2)] as [number, number],
      yDomain: [yLo, Math.max(yHi, yLo * 10)] as [number, number],
      xTicks: powerTicks(xLo, Math.max(xHi, xLo * 2)),
      yTicks: durationTicks(yLo, Math.max(yHi, yLo * 10)),
    };
  }, [combinedData, lineConfigs, compareMode]);

  // Apply zoom — snap ticks to what's visible
  const activeXDomain = zoomedX ?? xDomain;
  const activeXTicks = useMemo(
    () => powerTicks(activeXDomain[0], activeXDomain[1]),
    [activeXDomain],
  );

  // Reference lines that fall inside the current Y-domain. Out-of-range lines
  // are hidden so we don't squash the chart with labels.
  const visibleRefs = useMemo(
    () =>
      showRefs
        ? REFERENCE_LINES.filter((r) => r.y >= yDomain[0] && r.y <= yDomain[1])
        : [],
    [showRefs, yDomain],
  );

  const isEmpty = combinedData.length === 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative">
      {/* Top-right toolbar: refs toggle + reset zoom (when zoomed). */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        <button
          onClick={() => setShowRefs((v) => !v)}
          aria-pressed={showRefs}
          title={showRefs ? "Hide shutter-speed reference lines" : "Show shutter-speed reference lines"}
          className={cn(
            "inline-flex items-center gap-1 rounded border bg-card px-2 py-0.5 text-[11px] font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            showRefs
              ? "border-primary/40 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <Ruler className="h-3 w-3" />
          Refs
        </button>
        {zoomedX && (
          <button
            onClick={() => setZoomedX(null)}
            className="rounded border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
          >
            Reset zoom
          </button>
        )}
      </div>

      <div
        className={cn(
          "relative w-full",
          // Shorter on mobile so the picker isn't pushed below the fold
          "h-[360px] md:h-[520px]",
        )}
        style={{
          // Crosshair cursor advertises the drag-to-zoom affordance even when
          // not actively selecting. Switches to grabbing-style during drag.
          cursor: selecting ? "crosshair" : isEmpty ? "default" : "crosshair",
        }}
      >
        {/* Empty state — overlaid above the (still-rendered) axes. */}
        {isEmpty ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
            <div className="flex flex-col items-center gap-1 text-center text-muted-foreground">
              <MousePointer2 className="h-5 w-5" />
              <p className="text-sm">Pick a flash from the panel to start charting.</p>
            </div>
          </div>
        ) : null}

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={combinedData}
            // Right margin reserves a label gutter for direct line labels.
            margin={{ top: 16, right: 96, left: 8, bottom: 28 }}
            onMouseDown={onChartMouseDown}
            onMouseMove={onChartMouseMove}
            onMouseUp={onChartMouseUp}
            onMouseLeave={onChartMouseLeave}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="power"
              type="number"
              scale="log"
              domain={activeXDomain}
              ticks={activeXTicks}
              tickFormatter={(v) =>
                compareMode === "absolute" ? formatWs(v) : formatPower(v, powerAxis)
              }
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              label={{
                value:
                  compareMode === "absolute"
                    ? "Output (watt-seconds)"
                    : powerAxis === "fraction"
                      ? "Power (fraction of full)"
                      : "Power (stops below full)",
                position: "insideBottom",
                offset: -10,
                style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
              }}
            />
            <YAxis
              type="number"
              scale="log"
              domain={yDomain}
              ticks={yTicks}
              tickFormatter={(v) => formatDuration(v, durationAxis)}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11 }}
              width={80}
              label={{
                value: "Flash duration (t0.1)",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
              }}
            />
            <Tooltip
              cursor={
                selecting
                  ? false
                  : {
                      stroke: "hsl(var(--primary))",
                      strokeOpacity: 0.35,
                      strokeDasharray: "2 4",
                    }
              }
              content={
                selecting ? () => null : (
                  <CustomTooltip
                    powerAxis={powerAxis}
                    durationAxis={durationAxis}
                    compareMode={compareMode}
                    hoveredId={hoveredId}
                  />
                )
              }
            />

            {/* Photographer reference lines (horizontal at common shutter speeds). */}
            {visibleRefs.map((r) => (
              <ReferenceLine
                key={r.y}
                y={r.y}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.45}
                strokeDasharray="4 4"
                ifOverflow="hidden"
                label={{
                  value: r.label,
                  position: "insideTopRight",
                  fill: "hsl(var(--muted-foreground))",
                  fontSize: 10,
                }}
              />
            ))}

            {lineConfigs.map((cfg) => {
              const isHovered = hoveredId === cfg.id;
              const dimmed = hoveredId != null && !isHovered;
              return (
                <Line
                  key={cfg.id}
                  name={cfg.name}
                  dataKey={`t_${cfg.key}`}
                  type="monotone"
                  stroke={cfg.color}
                  strokeWidth={isHovered ? 3 : 2}
                  strokeDasharray={cfg.dashPattern}
                  strokeOpacity={dimmed ? 0.18 : 1}
                  dot={{
                    r: isHovered ? 4 : 3,
                    fill: cfg.color,
                    strokeWidth: 0,
                    opacity: dimmed ? 0.18 : 1,
                  }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                  connectNulls
                />
              );
            })}

            {/* Zoom selection highlight */}
            {selecting && refLeft != null && refRight != null && (
              <ReferenceArea
                x1={Math.min(refLeft, refRight)}
                x2={Math.max(refLeft, refRight)}
                fill="hsl(var(--primary))"
                fillOpacity={0.1}
                stroke="hsl(var(--primary))"
                strokeOpacity={0.4}
              />
            )}

            {/* Customized escape hatch: captures the rendered y-scale for the
                Voronoi-style hover, and renders direct line labels at the
                right edge with collision avoidance. Inspired by the FT Visual
                Vocabulary and NYT/Pudding line-chart conventions: keep the
                eye on the line by labeling it in place instead of forcing a
                legend lookup. */}
            <Customized
              component={(props: any) => {
                const yMap = props.yAxisMap as Record<string, any> | undefined;
                const yScale = yMap ? Object.values(yMap)[0]?.scale : null;
                if (yScale) scalesRef.current.y = yScale;

                if (!yScale || lineConfigs.length === 0) return null;

                const offset = props.offset as {
                  left: number;
                  top: number;
                  width: number;
                  height: number;
                };

                type LabelEntry = {
                  id: string;
                  name: string;
                  color: string;
                  y: number;
                };
                const labels: LabelEntry[] = [];
                for (const cfg of lineConfigs) {
                  // Rightmost reading for this series within the visible
                  // domain; that's where its line ends, where the label goes.
                  let lastRow: Record<string, any> | null = null;
                  for (let i = combinedData.length - 1; i >= 0; i--) {
                    const row = combinedData[i];
                    if (row.power < activeXDomain[0] || row.power > activeXDomain[1]) continue;
                    if (typeof row[`t_${cfg.key}`] === "number") {
                      lastRow = row;
                      break;
                    }
                  }
                  if (!lastRow) continue;
                  labels.push({
                    id: cfg.id,
                    name: cfg.name,
                    color: cfg.color,
                    y: yScale(lastRow[`t_${cfg.key}`]),
                  });
                }

                // Collision avoidance: sort top-down, nudge each label below
                // the previous one if they'd overlap. Then clamp to plot
                // bounds so nothing spills into the X axis.
                labels.sort((a, b) => a.y - b.y);
                const minSpacing = 12;
                for (let i = 1; i < labels.length; i++) {
                  if (labels[i].y - labels[i - 1].y < minSpacing) {
                    labels[i].y = labels[i - 1].y + minSpacing;
                  }
                }
                const plotTop = offset.top;
                const plotBottom = offset.top + offset.height;
                for (const l of labels) {
                  l.y = Math.max(plotTop, Math.min(plotBottom, l.y));
                }

                const labelX = offset.left + offset.width + 6;

                return (
                  <g pointerEvents="none">
                    {labels.map((l) => {
                      const isHovered = hoveredId === l.id;
                      const dimmed = hoveredId != null && !isHovered;
                      return (
                        <text
                          key={l.id}
                          x={labelX}
                          y={l.y}
                          dy="0.32em"
                          fontSize={10}
                          fontWeight={isHovered ? 600 : 400}
                          fill={l.color}
                          opacity={dimmed ? 0.25 : 1}
                        >
                          {truncateLabel(l.name, 16)}
                        </text>
                      );
                    })}
                  </g>
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Custom legend — supports hover-to-highlight by sharing hoveredId state. */}
      {lineConfigs.length > 0 ? (
        <CustomLegend
          configs={lineConfigs}
          hoveredId={hoveredId}
          onHover={setHoveredId}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodeKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
}

function truncateLabel(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function formatPower(power: number, axis: PowerAxis): string {
  const stops = Math.log2(power);
  if (axis === "fraction") return stopsToFraction(stops);
  return stopsToLabel(stops);
}

function formatDuration(seconds: number, axis: DurationAxis): string {
  if (axis === "one-over-x") return secondsToOneOverX(seconds);
  return secondsToPrecise(seconds);
}

function powerTicks(lo: number, hi: number): number[] {
  const ticks: number[] = [];
  let v = lo;
  while (v <= hi + 1e-12) {
    ticks.push(v);
    v *= 2;
  }
  return ticks;
}

function durationTicks(lo: number, hi: number): number[] {
  const ticks: number[] = [];
  let v = lo;
  while (v <= hi + 1e-12) {
    ticks.push(v);
    v *= 10;
  }
  return ticks;
}

function CustomLegend({
  configs,
  hoveredId,
  onHover,
}: {
  configs: { id: string; key: string; name: string; color: string; dashPattern: string }[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 text-xs">
      {configs.map((cfg) => {
        const dimmed = hoveredId != null && hoveredId !== cfg.id;
        return (
          <li
            key={cfg.id}
            onMouseEnter={() => onHover(cfg.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              "inline-flex cursor-default items-center gap-1.5 rounded px-1 py-0.5 transition-opacity",
              dimmed ? "opacity-40" : "opacity-100",
            )}
          >
            {/* Mini line swatch — solid block for solid lines, dashed inline for dashed */}
            <span
              aria-hidden="true"
              className="inline-block h-[2px] w-5 shrink-0"
              style={{
                background:
                  cfg.dashPattern === "0"
                    ? cfg.color
                    : `repeating-linear-gradient(to right, ${cfg.color} 0 5px, transparent 5px 9px)`,
              }}
            />
            <span className="truncate">{cfg.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

function CustomTooltip({
  active,
  payload,
  powerAxis,
  durationAxis,
  compareMode,
  hoveredId,
}: {
  active?: boolean;
  payload?: any[];
  powerAxis: PowerAxis;
  durationAxis: DurationAxis;
  compareMode: CompareMode;
  hoveredId: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  if (!row) return null;

  // Build entries with their resolved t values, then sort.
  type Entry = {
    key: string;
    color: string;
    name: string;
    t: number;
    ws: number | null | undefined;
    ct: number | null | undefined;
  };
  const entries: Entry[] = [];
  for (const p of payload) {
    if (p.value == null) continue;
    const key = String(p.dataKey).replace(/^t_/, "");
    entries.push({
      key,
      color: p.color,
      name: (row[`name_${key}`] as string | undefined) ?? p.name,
      t: p.value as number,
      ws: row[`ws_${key}`],
      ct: row[`ct_${key}`],
    });
  }

  // Sort fastest-first; pin the hovered series to the top so the user
  // immediately sees the line they're tracing even if it's slow.
  entries.sort((a, b) => a.t - b.t);
  const hoveredKey = hoveredId ? encodeKey(hoveredId) : null;
  if (hoveredKey) {
    const idx = entries.findIndex((e) => e.key === hoveredKey);
    if (idx > 0) {
      const [hit] = entries.splice(idx, 1);
      entries.unshift(hit);
    }
  }

  const visible = entries.slice(0, TOOLTIP_ROW_CAP);
  const hidden = entries.length - visible.length;

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold">
        {compareMode === "absolute" ? (
          formatWs(row.power)
        ) : (
          <>
            {formatPower(row.power, powerAxis)}{" "}
            <span className="text-muted-foreground">
              ({powerAxis === "fraction" ? stopsToLabel(row.stops) + " stops" : stopsToFraction(row.stops)})
            </span>
          </>
        )}
      </div>
      {visible.map((e) => {
        const isHover = hoveredKey != null && e.key === hoveredKey;
        return (
          <div
            key={e.key}
            className={cn(
              "flex items-center gap-2",
              isHover ? "font-semibold text-foreground" : "",
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
            <span className="flex-1 truncate">{e.name}</span>
            {e.ws != null ? (
              <span className="font-mono text-muted-foreground">{formatWs(e.ws)}</span>
            ) : null}
            <span className="font-mono">
              {durationAxis === "one-over-x" ? secondsToOneOverX(e.t) : secondsToPrecise(e.t)}
            </span>
            {e.ct ? <span className="font-mono text-muted-foreground">{e.ct}K</span> : null}
          </div>
        );
      })}
      {hidden > 0 ? (
        <div className="mt-1 text-[11px] text-muted-foreground">
          + {hidden} more series at this point
        </div>
      ) : null}
    </div>
  );
}
