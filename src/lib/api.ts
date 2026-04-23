import { NextResponse } from "next/server";
import { requireAdmin } from "./session";

export async function guardAdmin(): Promise<Response | null> {
  const ok = await requireAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
