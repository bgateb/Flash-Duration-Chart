import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, guardAdmin, notFound } from "@/lib/api";
import { deleteReading, updateReading } from "@/lib/queries";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const PatchBody = z.object({
  stops_below_full: z.number().min(-20).max(0),
  t_one_tenth_seconds: z.number().positive(),
  color_temp_k: z.number().int().min(1000).max(20000).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const n = parseId(id);
  if (!n) return notFound();
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const body = parsed.data;
  try {
    await updateReading(n, {
      stops_below_full: body.stops_below_full,
      t_one_tenth_seconds: body.t_one_tenth_seconds,
      color_temp_k: body.color_temp_k ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest("Another reading already uses that power level.");
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const n = parseId(id);
  if (!n) return notFound();
  await deleteReading(n);
  return NextResponse.json({ ok: true });
}
