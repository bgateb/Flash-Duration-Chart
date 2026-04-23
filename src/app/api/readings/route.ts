import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, guardAdmin } from "@/lib/api";
import { createReading } from "@/lib/queries";

export const dynamic = "force-dynamic";

const ReadingBody = z.object({
  flash_id: z.number().int().positive(),
  stops_below_full: z.number().min(-20).max(0),
  t_one_tenth_seconds: z.number().positive(),
  color_temp_k: z.number().int().min(1000).max(20000).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const parsed = ReadingBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const body = parsed.data;
  try {
    const id = await createReading(body.flash_id, {
      stops_below_full: body.stops_below_full,
      t_one_tenth_seconds: body.t_one_tenth_seconds,
      color_temp_k: body.color_temp_k ?? null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest("A reading already exists at this power level. Edit it instead.");
    }
    if (err?.code === "ER_NO_REFERENCED_ROW_2" || err?.code === "ER_NO_REFERENCED_ROW") {
      return badRequest("Flash does not exist");
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create reading" }, { status: 500 });
  }
}
