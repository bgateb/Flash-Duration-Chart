"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ColoredFlash } from "./FlashChartView";
import { stopsToFraction, stopsToLabel, formatWs, effectiveWs } from "@/lib/power";
import { secondsToOneOverX } from "@/lib/duration";

export function FlashDetail({
  flash,
  onClose,
}: {
  flash: ColoredFlash | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={flash != null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Panel */}
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
          aria-describedby={undefined}
        >
          {flash && <FlashDetailContent flash={flash} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FlashDetailContent({
  flash,
  onClose,
}: {
  flash: ColoredFlash;
  onClose: () => void;
}) {
  // Group readings by mode
  const byMode = flash.modes.map((mode) => {
    const readings = flash.readings
      .filter((r) => r.mode === mode)
      .sort((a, b) => b.stops_below_full - a.stops_below_full); // full power first
    const durations = readings.map((r) => r.t_one_tenth_seconds);
    const stops = readings.map((r) => r.stops_below_full);
    return {
      mode,
      readings,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      maxStops: Math.max(...stops),  // closest to full power
      minStops: Math.min(...stops),  // lowest power tested
    };
  });

  const totalReadings = flash.readings.length;

  return (
    <>
      {/* Header — left border uses the flash's chart color */}
      <div
        className="flex items-start justify-between gap-4 border-b px-5 py-4"
        style={{ borderLeftColor: flash.color, borderLeftWidth: 3 }}
      >
        <div>
          <Dialog.Title className="text-base font-semibold leading-snug">
            <span className="text-muted-foreground">{flash.manufacturer}</span>{" "}
            {flash.model}
          </Dialog.Title>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {flash.type ?? "Flash unit"}
          </p>
        </div>
        <Dialog.Close
          onClick={onClose}
          className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </div>

      {/* Body */}
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">

        {/* Quick stats */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {flash.rated_ws != null && (
            <Stat label="Rated output" value={`${flash.rated_ws} Ws`} />
          )}
          <Stat label="Readings" value={`${totalReadings} data point${totalReadings === 1 ? "" : "s"}`} />
          {flash.tested_on && (
            <Stat label="Tested" value={formatDate(flash.tested_on)} />
          )}
          {flash.firmware && (
            <Stat label="Firmware" value={flash.firmware} />
          )}
        </div>

        {/* Notes */}
        {flash.notes && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
            {flash.notes}
          </p>
        )}

        {/* Per-mode breakdown */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Modes tested
          </h3>
          <div className="space-y-3">
            {byMode.map(({ mode, readings, minDuration, maxDuration, minStops, maxStops }) => (
              <div key={mode} className="rounded-md border bg-background">
                <div className="flex items-center justify-between border-b px-3 py-1.5">
                  <span className="text-sm font-medium">{mode}</span>
                  <span className="text-xs text-muted-foreground">
                    {readings.length} reading{readings.length === 1 ? "" : "s"} ·{" "}
                    {stopsToFraction(maxStops)}
                    {minStops !== maxStops && <> → {stopsToFraction(minStops)}</>}
                  </span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-medium">Power</th>
                      {flash.rated_ws != null && (
                        <th className="px-3 py-1.5 text-right font-medium">Output</th>
                      )}
                      <th className="px-3 py-1.5 text-right font-medium">t0.1</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r) => (
                      <tr key={r.id} className="border-t border-border/50">
                        <td className="px-3 py-1 font-mono">
                          {stopsToFraction(r.stops_below_full)}{" "}
                          <span className="text-muted-foreground">
                            ({stopsToLabel(r.stops_below_full)})
                          </span>
                        </td>
                        {flash.rated_ws != null && (
                          <td className="px-3 py-1 text-right font-mono text-muted-foreground">
                            {formatWs(effectiveWs(r.stops_below_full, flash.rated_ws))}
                          </td>
                        )}
                        <td className="px-3 py-1 text-right font-mono font-medium">
                          {secondsToOneOverX(r.t_one_tenth_seconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {readings.length > 1 && (
                  <div className="border-t border-border/50 px-3 py-1.5 text-xs text-muted-foreground">
                    Duration range:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {secondsToOneOverX(maxDuration)}
                    </span>
                    {" "}(slowest) →{" "}
                    <span className="font-mono font-medium text-foreground">
                      {secondsToOneOverX(minDuration)}
                    </span>
                    {" "}(fastest)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
