"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { stopsToFraction, stopsToLabel, effectiveWs, formatWs } from "@/lib/power";
import { secondsToOneOverX, secondsToPrecise } from "@/lib/duration";
import type { PowerAxis, DurationAxis, CompareMode, Series } from "./FlashChartView";

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
    if (!selectingRef.current || !e || e.activeLabel == null) return;
    setRefRight(Number(e.activeLabel));
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative">
      {/* Reset zoom button — only visible when zoomed */}
      {zoomedX && (
        <button
          onClick={() => setZoomedX(null)}
          className="absolute right-2 top-2 z-10 rounded border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground"
        >
          Reset zoom
        </button>
      )}

      <div
        className="h-[520px] w-full"
        style={{ cursor: selecting ? "crosshair" : "default" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={combinedData}
            margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
            onMouseDown={onChartMouseDown}
            onMouseMove={onChartMouseMove}
            onMouseUp={onChartMouseUp}
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
                    ? "Output (Ws)"
                    : powerAxis === "fraction"
                      ? "Power (fraction of full)"
                      : "Power (stops below full)",
                position: "insideBottom",
                offset: -4,
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
                value: "t.1 duration",
                angle: -90,
                position: "insideLeft",
                offset: 10,
                style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
              }}
            />
            <Tooltip
              content={
                selecting ? () => null : (
                  <CustomTooltip
                    powerAxis={powerAxis}
                    durationAxis={durationAxis}
                    compareMode={compareMode}
                  />
                )
              }
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="plainline"
              wrapperStyle={{ fontSize: 12 }}
            />
            {lineConfigs.map((cfg) => (
              <Line
                key={cfg.id}
                name={cfg.name}
                dataKey={`t_${cfg.key}`}
                type="monotone"
                stroke={cfg.color}
                strokeWidth={2}
                strokeDasharray={cfg.dashPattern}
                dot={{ r: 3, fill: cfg.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                connectNulls
              />
            ))}

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
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Zoom hint — only shown when nothing is zoomed */}
      {!zoomedX && combinedData.length > 0 && (
        <p className="mt-1 text-center text-[10px] text-muted-foreground/60 select-none">
          Drag to zoom
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodeKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "_");
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

function CustomTooltip({
  active,
  payload,
  powerAxis,
  durationAxis,
  compareMode,
}: {
  active?: boolean;
  payload?: any[];
  powerAxis: PowerAxis;
  durationAxis: DurationAxis;
  compareMode: CompareMode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  if (!row) return null;
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
      {payload
        .filter((p) => p.value != null)
        .map((p, i) => {
          const key = String(p.dataKey).replace(/^t_/, "");
          const t = p.value as number;
          const ws = row[`ws_${key}`] as number | null | undefined;
          const ct = row[`ct_${key}`] as number | null | undefined;
          const name = (row[`name_${key}`] as string | undefined) ?? p.name;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="flex-1 truncate">{name}</span>
              {ws != null ? <span className="font-mono text-muted-foreground">{formatWs(ws)}</span> : null}
              <span className="font-mono">
                {durationAxis === "one-over-x" ? secondsToOneOverX(t) : secondsToPrecise(t)}
              </span>
              {ct ? <span className="font-mono text-muted-foreground">{ct}K</span> : null}
            </div>
          );
        })}
    </div>
  );
}
