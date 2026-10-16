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

  // 1. Sesi Supabase valid? (getUser memvalidasi token ke Supabase Auth)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loginUrl = new URL("/login", request.url);
  const fail = () => NextResponse.redirect(loginUrl);

  if (!user) {
    if (PUBLIC_PATHS.includes(pathname)) return response;
    return fail();
  }

  // 2. Terdaftar sebagai staf? (via service_role, bypass RLS)
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let role: string | null = null;
  try {
    const roleRes = await fetch(
      `${supabaseUrl()}/rest/v1/admin_roles?user_id=eq.${user.id}&select=role`,
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
  } catch {
    return new NextResponse("Layanan autentikasi tidak tersedia. Coba lagi.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
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
