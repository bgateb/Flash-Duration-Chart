import { NextResponse, type NextRequest } from "next/server";

// Temporary diagnostic middleware: logs every incoming request so we can
// see what Apache is actually forwarding. Remove once /-routing is fixed.
export function middleware(req: NextRequest) {
  console.log(
    `[req] method=${req.method} url=${req.url} pathname=${req.nextUrl.pathname} host=${req.headers.get("host")} x-forwarded-host=${req.headers.get("x-forwarded-host") ?? "-"} x-forwarded-proto=${req.headers.get("x-forwarded-proto") ?? "-"}`
  );
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
