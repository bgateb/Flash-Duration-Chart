import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-config";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  try {
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    if (session.isAdmin) return res;
  } catch {
    // fall through to redirect on any session decode failure
  }
  // Relative Location so the browser resolves against the original public URL
  // (the upstream Apache proxy doesn't preserve Host, so req.nextUrl points at
  // 127.0.0.1:3000 and an absolute redirect would leak the internal host).
  return new NextResponse(null, {
    status: 307,
    headers: { Location: "/login" },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
