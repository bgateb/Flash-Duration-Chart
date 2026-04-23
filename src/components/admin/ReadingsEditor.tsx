"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Reading } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parsePowerInput, stopsToExactInput } from "@/lib/power";
import { parseDurationInput, secondsToExactInput } from "@/lib/duration";

type Draft = {
  id: number | null;
  powerInput: string;
  durationInput: string;
  colorTempInput: string;
  notesInput: string;
  savedStops: number | null;
  savedSeconds: number | null;
  dirty: boolean;
  saving: boolean;
  error?: string;
};

function draftFromReading(r: Reading): Draft {
  return {
    id: r.id,
    powerInput: stopsToExactInput(r.stops_below_full),
    durationInput: secondsToExactInput(r.t_one_tenth_seconds),
    colorTempInput: r.color_temp_k != null ? String(r.color_temp_k) : "",
    notesInput: r.notes ?? "",
    savedStops: r.stops_below_full,
    savedSeconds: r.t_one_tenth_seconds,
    dirty: false,
    saving: false,
  };
}

function emptyDraft(): Draft {
  return {
    id: null,
    powerInput: "",
    durationInput: "",
    colorTempInput: "",
    notesInput: "",
    savedStops: null,
    savedSeconds: null,
    dirty: true,
    saving: false,
  };
}

export function ReadingsEditor({ flashId, initial }: { flashId: number; initial: Reading[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Draft[]>(() => initial.map(draftFromReading));
  const [newRow, setNewRow] = useState<Draft>(emptyDraft());

  function updateRow(idx: number, patch: Partial<Draft>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch, dirty: true } : r)));
  }
  function updateNew(patch: Partial<Draft>) {
    setNewRow((prev) => ({ ...prev, ...patch }));
  }

  async function saveRow(idx: number) {
    const row = rows[idx];
    if (!row) return;
    const stops = parsePowerInput(row.powerInput);
    const seconds = parseDurationInput(row.durationInput);
    const ct = row.colorTempInput.trim() === "" ? null : Number(row.colorTempInput);
    if (stops == null || !(stops <= 0)) return updateRow(idx, { error: "Power must be 1/1, 1/2, … or a non-positive stop value" });
    if (seconds == null || !(seconds > 0)) return updateRow(idx, { error: "Duration must be 1/Xs or seconds" });
    if (ct != null && (!Number.isFinite(ct) || ct < 1000 || ct > 20000)) {
      return updateRow(idx, { error: "Color temp must be between 1000 and 20000" });
    }
    updateRow(idx, { saving: true, error: undefined });
    try {
      const res = await fetch(`/api/readings/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stops_below_full: stops,
          t_one_tenth_seconds: seconds,
          color_temp_k: ct,
          notes: row.notesInput.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      setRows((prev) =>
        prev.map((r, i) =>
          i === idx ? { ...r, savedStops: stops, savedSeconds: seconds, dirty: false, saving: false } : r
        )
      );
      router.refresh();
    } catch (err: any) {
      updateRow(idx, { saving: false, error: err.message });
    }
  }

  async function deleteRow(idx: number) {
    const row = rows[idx];
    if (!row?.id) return;
    if (!window.confirm("Delete this reading?")) return;
    try {
      const res = await fetch(`/api/readings/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setRows((prev) => prev.filter((_, i) => i !== idx));
      router.refresh();
    } catch (err: any) {
      updateRow(idx, { error: err.message });
    }
  }

  async function addNew() {
    const stops = parsePowerInput(newRow.powerInput);
    const seconds = parseDurationInput(newRow.durationInput);
    const ct = newRow.colorTempInput.trim() === "" ? null : Number(newRow.colorTempInput);
    if (stops == null || !(stops <= 0)) return setNewRow((p) => ({ ...p, error: "Power must be 1/1, 1/2, … or a non-positive stop value" }));
    if (seconds == null || !(seconds > 0)) return setNewRow((p) => ({ ...p, error: "Duration must be 1/Xs or seconds" }));
    if (ct != null && (!Number.isFinite(ct) || ct < 1000 || ct > 20000)) {
      return setNewRow((p) => ({ ...p, error: "Color temp must be between 1000 and 20000" }));
    }
    setNewRow((p) => ({ ...p, saving: true, error: undefined }));
    try {
      const res = await fetch(`/api/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flash_id: flashId,
          stops_below_full: stops,
          t_one_tenth_seconds: seconds,
          color_temp_k: ct,
          notes: newRow.notesInput.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setRows((prev) =>
        [
          ...prev,
          {
            id: body.id,
            powerInput: newRow.powerInput,
            durationInput: newRow.durationInput,
            colorTempInput: ct != null ? String(ct) : "",
            notesInput: newRow.notesInput.trim(),
            savedStops: stops,
            savedSeconds: seconds,
            dirty: false,
            saving: false,
          },
        ].sort((a, b) => (b.savedStops ?? 0) - (a.savedStops ?? 0))
      );
      setNewRow(emptyDraft());
      router.refresh();
    } catch (err: any) {
      setNewRow((p) => ({ ...p, saving: false, error: err.message }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="grid grid-cols-[1.1fr,1.2fr,0.9fr,1.5fr,auto] gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>Power</span>
          <span>t.1 (1/X or seconds)</span>
          <span>Color temp K</span>
          <span>Notes</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">No readings yet. Add one below.</p>
        ) : (
          rows.map((row, idx) => (
            <div key={row.id ?? idx} className="grid grid-cols-[1.1fr,1.2fr,0.9fr,1.5fr,auto] gap-2 border-b px-3 py-2 last:border-b-0">
              <Input
                value={row.powerInput}
                onChange={(e) => updateRow(idx, { powerInput: e.target.value })}
                placeholder="1/32 or -5"
              />
              <Input
                value={row.durationInput}
                onChange={(e) => updateRow(idx, { durationInput: e.target.value })}
                placeholder="1/4000 or 0.00025"
              />
              <Input
                value={row.colorTempInput}
                onChange={(e) => updateRow(idx, { colorTempInput: e.target.value })}
                placeholder="5600"
              />
              <Input
                value={row.notesInput}
                onChange={(e) => updateRow(idx, { notesInput: e.target.value })}
                placeholder=""
              />
              <div className="flex items-center gap-1">
                <Button size="sm" variant={row.dirty ? "default" : "outline"} disabled={!row.dirty || row.saving} onClick={() => saveRow(idx)}>
                  {row.saving ? "…" : "save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteRow(idx)}>✕</Button>
              </div>
              {row.error ? (
                <p className="col-span-5 text-xs text-destructive">{row.error}</p>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="rounded-md border border-dashed p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add reading</p>
        <div className="grid grid-cols-[1.1fr,1.2fr,0.9fr,1.5fr,auto] gap-2">
          <Input value={newRow.powerInput} onChange={(e) => updateNew({ powerInput: e.target.value })} placeholder="1/32 or -5" />
          <Input value={newRow.durationInput} onChange={(e) => updateNew({ durationInput: e.target.value })} placeholder="1/4000 or 0.00025" />
          <Input value={newRow.colorTempInput} onChange={(e) => updateNew({ colorTempInput: e.target.value })} placeholder="5600" />
          <Input value={newRow.notesInput} onChange={(e) => updateNew({ notesInput: e.target.value })} placeholder="" />
          <Button size="sm" onClick={addNew} disabled={newRow.saving}>
            {newRow.saving ? "…" : "add"}
          </Button>
        </div>
        {newRow.error ? <p className="mt-2 text-xs text-destructive">{newRow.error}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Power accepts <code className="font-mono">1/1</code>, <code>1/32</code>, or stops (<code>-5</code>).
          Duration accepts <code>1/4000</code>, <code>0.00025</code>, <code>0.25ms</code>, or <code>250µs</code>.
        </p>
      </div>
    </div>
  );
}
