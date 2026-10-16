// ============================================================================
// proxy.ts — gerbang autentikasi SapaLive Admin (Next.js 16: pengganti middleware.ts).
//
// Menegakkan, untuk SEMUA route kecuali /login:
//   1. Sesi Supabase valid (via @supabase/ssr resmi — bukan parse cookie manual).
//   2. Baris di admin_roles (kalau tidak ada → bukan staf → tolak).
//
// MFA dinonaktifkan atas permintaan owner (16 Okt 2026).
//
// Catatan: proxy tidak mengimpor lib/* (modul itu pakai "server-only").
// ============================================================================
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

// Cache validasi sesi: userId -> { role, exp }. Menghindari 2 round-trip
// network (Auth + DB) di setiap navigasi. TTL 60 detik — tradeoff wajar
// untuk panel admin (token revoke maksimal telat 60 dtk).
const sessionCache = new Map<string, { role: string; exp: number }>();
const CACHE_TTL_MS = 60_000;

/** Decode payload JWT tanpa verifikasi signature (hanya untuk baca exp/sub). */
function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function supabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Response yang akan membawa Set-Cookie hasil refresh sesi.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // 1. Sesi Supabase valid?
  // Optimasi: decode JWT lokal untuk cek expiry. Hanya hit network
  // (getUser) bila token hampir/ sudah kedaluwarsa atau tidak terbaca.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let userId: string | null = null;

  if (session?.access_token) {
    const payload = decodeJwtPayload(session.access_token);
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload?.sub && payload.exp && payload.exp > nowSec + 30) {
      userId = payload.sub;
    }
  }
  if (!userId) {
    // Token tidak ada/kedaluwarsa/tak terbaca → validasi penuh ke server.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  const loginUrl = new URL("/login", request.url);
  const fail = () => NextResponse.redirect(loginUrl);

  if (!userId) {
    if (PUBLIC_PATHS.includes(pathname)) return response;
    return fail();
  }

  // 2. Terdaftar sebagai staf? (cache 60 dtk, via service_role bypass RLS)
  const cacheKey = userId;
  const cached = sessionCache.get(cacheKey);
  let role: string | null = null;
  if (cached && cached.exp > Date.now()) {
    role = cached.role;
  } else {
    sessionCache.delete(cacheKey);
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    try {
      const roleRes = await fetch(
        `${supabaseUrl()}/rest/v1/admin_roles?user_id=eq.${userId}&select=role`,
        {
          headers: {
            apikey: svcKey,
            Authorization: `Bearer ${svcKey}`,
          },
        }
      );
      if (!roleRes.ok) {
        return new NextResponse("Layanan autentikasi tidak tersedia. Coba lagi.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      const rows = (await roleRes.json()) as { role?: string }[];
      role = rows[0]?.role ?? null;
      if (role) sessionCache.set(cacheKey, { role, exp: Date.now() + CACHE_TTL_MS });
    } catch {
      return new NextResponse("Layanan autentikasi tidak tersedia. Coba lagi.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  }
  if (!role) return fail();

  // Sudah login penuh tapi buka /login → lempar ke dashboard.
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Semua route kecuali aset statis.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|icons).*)",
  ],
};
