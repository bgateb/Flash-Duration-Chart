import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "Server missing ADMIN_PASSWORD" }, { status: 500 });
  }
  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }
  const session = await getSession();
  session.isAdmin = true;
  await session.save();
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
