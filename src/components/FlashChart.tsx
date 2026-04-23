"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { FlashWithReadings } from "@/lib/types";
import { stopsToFraction, stopsToLabel } from "@/lib/power";
import { secondsToOneOverX, secondsToPrecise } from "@/lib/duration";
import type { PowerAxis, DurationAxis } from "./FlashChartView";

type Colored = FlashWithReadings & { color: string };

export function FlashChart({
  flashes,
  powerAxis,
  durationAxis,
}: {
  flashes: Colored[];
  powerAxis: PowerAxis;
  durationAxis: DurationAxis;
}) {
  // Build one series per flash; each point carries power (as power fraction in [0,1]) and t.1 seconds.
  const series = useMemo(() => {
    return flashes.map((f) => ({
      id: f.id,
      name: `${f.manufacturer} ${f.model}${f.mode ? ` — ${f.mode}` : ""}`,
      color: f.color,
      data: f.readings
        .map((r) => ({
          power: Math.pow(2, r.stops_below_full), // 1, 0.5, 0.25, ...
          stops: r.stops_below_full,
          t: r.t_one_tenth_seconds,
          ct: r.color_temp_k,
          notes: r.notes,
          flashName: `${f.manufacturer} ${f.model}`,
        }))
        .sort((a, b) => a.power - b.power),
    }));
  }, [flashes]);

  // Axis domains — computed across visible data so toggling flashes rescales sensibly.
  const { xDomain, yDomain, xTicks, yTicks } = useMemo(() => {
    const allX: number[] = [];
    const allY: number[] = [];
    for (const s of series) for (const p of s.data) {
      allX.push(p.power);
      allY.push(p.t);
    }
    if (allX.length === 0) {
      return {
        xDomain: [1 / 256, 1] as [number, number],
        yDomain: [0.00001, 0.01] as [number, number],
        xTicks: powerTicks(1 / 256, 1),
        yTicks: durationTicks(0.00001, 0.01),
      };
    }
    const xmin = Math.min(...allX);
    const xmax = Math.max(...allX);
    const ymin = Math.min(...allY);
    const ymax = Math.max(...allY);
    // Snap to log-decade/log2 bounds
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
  }, [series]);

  return (
    <div className="h-[520px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="power"
            type="number"
            scale="log"
            domain={xDomain}
            ticks={xTicks}
            tickFormatter={(v) => formatPower(v, powerAxis)}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11 }}
            label={{
              value: powerAxis === "fraction" ? "Power (fraction of full)" : "Power (stops below full)",
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
          <Tooltip content={<CustomTooltip powerAxis={powerAxis} durationAxis={durationAxis} />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12 }}
          />
          {series.map((s) => (
            <Line
              key={s.id}
              name={s.name}
              data={s.data}
              dataKey="t"
              type="monotone"
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
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
}: {
  active?: boolean;
  payload?: any[];
  powerAxis: PowerAxis;
  durationAxis: DurationAxis;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload.map((p) => p.payload).filter(Boolean);
  if (rows.length === 0) return null;
  const first = rows[0];
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold">
        {formatPower(first.power, powerAxis)}{" "}
        <span className="text-muted-foreground">
          ({powerAxis === "fraction" ? stopsToLabel(first.stops) + " stops" : stopsToFraction(first.stops)})
        </span>
      </div>
      {payload.map((p, i) => {
        const d = p.payload;
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 truncate">{d.flashName}</span>
            <span className="font-mono">
              {durationAxis === "one-over-x" ? secondsToOneOverX(d.t) : secondsToPrecise(d.t)}
            </span>
            {d.ct ? <span className="font-mono text-muted-foreground">{d.ct}K</span> : null}
          </div>
        );
      })}
    </div>
  );
}
