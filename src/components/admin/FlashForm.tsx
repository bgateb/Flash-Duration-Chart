"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Flash } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FlashForm({ initial }: { initial?: Flash }) {
  const router = useRouter();
  const [form, setForm] = useState({
    manufacturer: initial?.manufacturer ?? "",
    model: initial?.model ?? "",
    slug: initial?.slug ?? "",
    mode: initial?.mode ?? "",
    firmware: initial?.firmware ?? "",
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
      const payload = {
        manufacturer: form.manufacturer.trim(),
        model: form.model.trim(),
        slug: form.slug.trim() || undefined,
        mode: form.mode.trim() || null,
        firmware: form.firmware.trim() || null,
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
        router.push(`/admin/flashes/${body.id}`);
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
        <Field label="Mode" placeholder="Normal / Freeze / Action" value={form.mode} onChange={(v) => set("mode", v)} />
        <Field label="Firmware" value={form.firmware} onChange={(v) => set("firmware", v)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tested on" type="date" value={form.tested_on ?? ""} onChange={(v) => set("tested_on", v)} />
        <Field label="Slug (optional)" placeholder="auto from make + model" value={form.slug} onChange={(v) => set("slug", v)} />
      </div>
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
