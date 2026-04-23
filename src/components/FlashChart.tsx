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
import { stopsToFraction, stopsToLabel, effectiveWs, formatWs } from "@/lib/power";
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
  // Build a SHARED dataset (one row per unique power level, with one t/ws/ct
  // column per flash). Recharts' tooltip can only correctly attribute payload
  // entries when all <Line>s share the parent <LineChart>'s data — when each
  // <Line> has its own data prop, the tooltip mis-shows the same point for all
  // lines. The flash id is encoded in the dataKey suffix.
  const { combinedData, lineConfigs } = useMemo(() => {
    const xMap = new Map<number, Record<string, any>>();
    for (const f of flashes) {
      for (const r of f.readings) {
        const x = Math.pow(2, r.stops_below_full);
        const key = x;
        if (!xMap.has(key)) xMap.set(key, { power: x, stops: r.stops_below_full });
        const row = xMap.get(key)!;
        row[`t_${f.id}`] = r.t_one_tenth_seconds;
        row[`ws_${f.id}`] = effectiveWs(r.stops_below_full, f.rated_ws);
        row[`ct_${f.id}`] = r.color_temp_k;
        row[`notes_${f.id}`] = r.notes;
        row[`name_${f.id}`] = `${f.manufacturer} ${f.model}`;
      }
    }
    const combinedData = Array.from(xMap.values()).sort((a, b) => a.power - b.power);
    const lineConfigs = flashes.map((f) => ({
      id: f.id,
      name: `${f.manufacturer} ${f.model}${f.mode ? ` — ${f.mode}` : ""}`,
      color: f.color,
      dataKey: `t_${f.id}`,
    }));
    return { combinedData, lineConfigs };
  }, [flashes]);

  // Axis domains — computed across visible data so toggling flashes rescales sensibly.
  const { xDomain, yDomain, xTicks, yTicks } = useMemo(() => {
    const allX: number[] = [];
    const allY: number[] = [];
    for (const row of combinedData) {
      allX.push(row.power);
      for (const f of flashes) {
        const v = row[`t_${f.id}`];
        if (typeof v === "number") allY.push(v);
      }
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
  }, [combinedData, flashes]);

  return (
    <div className="h-[520px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={combinedData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
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
          {lineConfigs.map((cfg) => (
            <Line
              key={cfg.id}
              name={cfg.name}
              dataKey={cfg.dataKey}
              type="monotone"
              stroke={cfg.color}
              strokeWidth={2}
              dot={{ r: 3, fill: cfg.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              connectNulls
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
  // All payload entries share the same parent data row (one row per power
  // value). Read per-flash data via the dataKey suffix (`t_<flashId>` etc.).
  const row = payload[0].payload;
  if (!row) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold">
        {formatPower(row.power, powerAxis)}{" "}
        <span className="text-muted-foreground">
          ({powerAxis === "fraction" ? stopsToLabel(row.stops) + " stops" : stopsToFraction(row.stops)})
        </span>
      </div>
      {payload
        .filter((p) => p.value != null)
        .map((p, i) => {
          const flashId = String(p.dataKey).replace(/^t_/, "");
          const t = p.value as number;
          const ws = row[`ws_${flashId}`] as number | null | undefined;
          const ct = row[`ct_${flashId}`] as number | null | undefined;
          const flashName = (row[`name_${flashId}`] as string | undefined) ?? p.name;
          return (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 truncate">{flashName}</span>
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
