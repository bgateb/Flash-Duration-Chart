import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, guardAdmin } from "@/lib/api";
import { createFlash, listFlashes } from "@/lib/queries";
import { slugify } from "@/lib/slug";
import { FLASH_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const flashes = await listFlashes();
  return NextResponse.json({ flashes });
}

const FlashBody = z.object({
  manufacturer: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(200),
  type: z.enum(FLASH_TYPES).nullable().optional(),
  slug: z.string().trim().max(220).optional(),
  firmware: z.string().trim().max(100).nullable().optional(),
  rated_ws: z.number().int().min(0).max(65535).nullable().optional(),
  tested_on: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const parsed = FlashBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const body = parsed.data;
  const slug = body.slug && body.slug.length > 0
    ? slugify(body.slug)
    : slugify(`${body.manufacturer} ${body.model}`);
  try {
    const id = await createFlash({
      manufacturer: body.manufacturer,
      model: body.model,
      type: body.type ?? null,
      slug,
      firmware: body.firmware ?? null,
      rated_ws: body.rated_ws ?? null,
      tested_on: body.tested_on ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ id, slug }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest("A flash with that slug already exists");
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create flash" }, { status: 500 });
  }
}
