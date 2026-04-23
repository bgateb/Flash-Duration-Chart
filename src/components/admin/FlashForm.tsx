"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Flash, FlashType } from "@/lib/types";
import { FLASH_TYPES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FlashForm({ initial }: { initial?: Flash }) {
  const router = useRouter();
  const [form, setForm] = useState({
    manufacturer: initial?.manufacturer ?? "",
    model: initial?.model ?? "",
    type: initial?.type ?? "",
    slug: initial?.slug ?? "",
    firmware: initial?.firmware ?? "",
    rated_ws: initial?.rated_ws != null ? String(initial.rated_ws) : "",
    tested_on: initial?.tested_on ?? "",
    notes: initial?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const ratedWsRaw = form.rated_ws.trim();
      const ratedWs = ratedWsRaw === "" ? null : Number(ratedWsRaw);
      if (ratedWs != null && (!Number.isFinite(ratedWs) || ratedWs < 0 || ratedWs > 65535 || !Number.isInteger(ratedWs))) {
        throw new Error("Rated power must be a whole number of watt-seconds (0–65535)");
      }
      const payload = {
        manufacturer: form.manufacturer.trim(),
        model: form.model.trim(),
        type: form.type === "" ? null : (form.type as FlashType),
        slug: form.slug.trim() || undefined,
        firmware: form.firmware.trim() || null,
        rated_ws: ratedWs,
        tested_on: form.tested_on.trim() || null,
        notes: form.notes.trim() || null,
      };
      const url = initial ? `/api/flashes/${initial.id}` : "/api/flashes";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      const body = await res.json();
      if (!initial && body.id) {
        router.push(`/admin/flashes/edit?id=${body.id}`);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!initial) return;
    if (!window.confirm("Delete this flash and all its readings? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/flashes/${initial.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Manufacturer" required value={form.manufacturer} onChange={(v) => set("manufacturer", v)} />
        <Field label="Model" required value={form.model} onChange={(v) => set("model", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">—</option>
            {FLASH_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Field label="Rated power (Ws)" placeholder="e.g. 200" value={form.rated_ws} onChange={(v) => set("rated_ws", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Firmware" value={form.firmware} onChange={(v) => set("firmware", v)} />
        <Field label="Tested on" type="date" value={form.tested_on ?? ""} onChange={(v) => set("tested_on", v)} />
      </div>
      <Field label="Slug (optional)" placeholder="auto from make + model" value={form.slug} onChange={(v) => set("slug", v)} />
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex items-center justify-between">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : initial ? "Save changes" : "Create"}
        </Button>
        {initial ? (
          <Button type="button" variant="destructive" onClick={onDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete flash"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
