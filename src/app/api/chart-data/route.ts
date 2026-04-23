import { NextResponse } from "next/server";
import { listAllWithReadings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listAllWithReadings();
    return NextResponse.json({ flashes: data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load chart data" }, { status: 500 });
  }
}
