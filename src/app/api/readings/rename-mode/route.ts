import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, guardAdmin } from "@/lib/api";
import { renameReadingsMode } from "@/lib/queries";

export const dynamic = "force-dynamic";

const Body = z.object({
  flash_id: z.number().int().positive(),
  from: z.string().trim().min(1).max(40),
  to: z.string().trim().min(1).max(40),
});

export async function POST(req: Request) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.message);
  const { flash_id, from, to } = parsed.data;
  if (from === to) return NextResponse.json({ ok: true, updated: 0 });
  try {
    const updated = await renameReadingsMode(flash_id, from, to);
    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    if (err?.code === "ER_DUP_ENTRY") {
      return badRequest(
        "Target mode already has a reading at one of those power levels."
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to rename mode" }, { status: 500 });
  }
}
