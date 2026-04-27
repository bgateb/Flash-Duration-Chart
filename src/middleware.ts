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
  // Apache's mod_proxy_http forwards to 127.0.0.1:3000 without preserving Host,
  // so build the redirect from X-Forwarded-Host/Proto (set by mod_proxy itself)
  // to avoid leaking the internal host in the Location header.
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : req.nextUrl.protocol.replace(":", ""));
  return NextResponse.redirect(new URL("/login", `${proto}://${host}`));
}

export const config = {
  matcher: ["/admin/:path*"],
};
