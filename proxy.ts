// ============================================================================
// proxy.ts — gerbang anti-scraping API SapaLive (Next.js 16).
//
// - Request API dengan sinyal bot kuat → diberi header x-suspected-bot: 1.
//   Route API (mis. /api/discover) lalu menyajikan data umpan "Jarvis".
// - Abuse ekstrem (>60 req/menit/IP) → 429 langsung.
// - Ringan: tanpa query DB, tanpa memblokir user asli.
// ============================================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isSuspectedBot, isRateAbuse } from "./lib/antibot";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name));
}

export async function proxy(request: NextRequest) {
  const ip = clientIp(request);
  const pathname = request.nextUrl.pathname;

  if (isRateAbuse(ip, pathname)) {
    return new NextResponse("Terlalu banyak permintaan.", { status: 429 });
  }

  const suspected = isSuspectedBot({
    userAgent: request.headers.get("user-agent"),
    acceptLanguage: request.headers.get("accept-language"),
    secFetchMode: request.headers.get("sec-fetch-mode"),
    hasSessionCookie: hasSessionCookie(request),
  });

  const res = NextResponse.next();
  if (suspected) {
    // Teruskan sebagai header internal; route API yang memutuskan umpan.
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-suspected-bot", "1");
    return NextResponse.next({ request: { headers: reqHeaders } });
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
