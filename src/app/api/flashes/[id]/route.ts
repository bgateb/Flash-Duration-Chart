import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, guardAdmin, notFound } from "@/lib/api";
import { deleteFlash, getFlash, listReadings, updateFlash } from "@/lib/queries";
import { slugify } from "@/lib/slug";
import { FLASH_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = parseId(id);
  if (!n) return notFound();
  const flash = await getFlash(n);
  if (!flash) return notFound();
  const readings = await listReadings(n);
  return NextResponse.json({ flash, readings });
}

const PatchBody = z.object({
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(200),
  type: z.enum(FLASH_TYPES).nullable().optional(),
  slug: z.string().trim().max(220).optional(),
  firmware: z.string().trim().max(100).nullable().optional(),
  rated_ws: z.number().int().min(0).max(65535).nullable().optional(),
  tested_on: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
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
  const slug = body.slug && body.slug.length > 0
    ? slugify(body.slug)
    : slugify(`${body.manufacturer} ${body.model}`);
  try {
    await updateFlash(n, {
      manufacturer: body.manufacturer,
      model: body.model,
      type: body.type ?? null,
      slug,
      firmware: body.firmware ?? null,
      rated_ws: body.rated_ws ?? null,
      tested_on: body.tested_on ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ ok: true, slug });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest("A flash with that slug already exists");
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
  await deleteFlash(n);
  return NextResponse.json({ ok: true });
}
