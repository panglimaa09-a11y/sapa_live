// ============================================================================
// proxy.ts — gerbang autentikasi SapaLive Admin (Next.js 16: pengganti middleware.ts).
//
// Menegakkan, untuk SEMUA route kecuali /login:
//   1. Sesi Supabase valid (divalidasi ke Supabase Auth, bukan sekadar cookie ada).
//   2. Baris di admin_roles (kalau tidak ada → bukan staf → tolak).
//   3. MFA: jika sudah enroll → cookie `admfa` harus valid; jika belum enroll →
//      paksa ke /mfa-setup (MFA wajib untuk administrator produksi).
//
// Catatan arsitektur: proxy berjalan terpisah dari render code (bisa di edge),
// jadi TIDAK mengimpor modul lib/* — semua helper (HMAC WebCrypto, parse cookie)
// ditulis inline di sini. Pemeriksaan izin per-halaman tetap dilakukan ulang di
// server components via requirePermission() (defense in depth).
// ============================================================================
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];
const MFA_FLOW_PATHS = ["/mfa", "/mfa-setup"];

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Ambil access token dari cookie sesi Supabase (mendukung chunk .0, .1, ...). */
function getAccessToken(req: NextRequest): string | null {
  let base: string | null = null;
  for (const c of req.cookies.getAll()) {
    const m = c.name.match(/^(sb-.*-auth-token)(\.\d+)?$/);
    if (m) {
      base = m[1];
      break;
    }
  }
  if (!base) return null;
  let raw = "";
  for (let i = 0; ; i++) {
    const v = req.cookies.get(i === 0 ? base : `${base}.${i}`)?.value;
    if (v === undefined) break;
    raw += v;
  }
  if (!raw) return null;
  try {
    const arr = JSON.parse(b64urlDecode(raw));
    return Array.isArray(arr) && typeof arr[0] === "string" ? arr[0] : null;
  } catch {
    return null;
  }
}

async function hmacHex(keyStr: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const keyHash = await crypto.subtle.digest("SHA-256", enc.encode(keyStr));
  const key = await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifikasi cookie admfa: "userId.exp.sigHex". Return userId atau null. */
async function verifyMfaCookie(
  value: string | undefined,
  signingKey: string
): Promise<string | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = await hmacHex(signingKey, `${userId}.${exp}`);
  return timingSafeEq(sig, expected) ? userId : null;
}

async function supaFetch(path: string, token: string, serviceRole: boolean) {
  const base = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = serviceRole
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "");
  const res = await fetch(`${base}${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const loginUrl = new URL("/login", request.url);
  const fail = () => {
    const res = NextResponse.redirect(loginUrl);
    // Bersihkan cookie sesi yang tidak valid agar tidak dipakai ulang.
    for (const c of request.cookies.getAll()) {
      if (/^sb-.*-auth-token/.test(c.name) || c.name === "admfa") {
        res.cookies.delete(c.name);
      }
    }
    return res;
  };

  // 1. Sesi Supabase valid?
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    return fail();
  }
  const meRes = await supaFetch("/auth/v1/user", accessToken, false);
  if (!meRes.ok) {
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    return fail();
  }
  const me = (await meRes.json()) as { id?: string };
  const userId = me.id;
  if (!userId) {
    if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
    return fail();
  }

  // 2. Terdaftar sebagai staf?
  // Kegagalan DB di sini → 503, BUKAN logout (jangan mengusir admin yang
  // sah hanya karena Supabase sempat tidak terjangkau).
  const unavailable = () =>
    new NextResponse("Layanan autentikasi tidak tersedia. Coba lagi.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  let roles: { role?: string }[];
  try {
    const roleRes = await supaFetch(
      `/rest/v1/admin_roles?user_id=eq.${userId}&select=role`,
      svcKey,
      true
    );
    if (!roleRes.ok) return unavailable();
    roles = (await roleRes.json()) as { role?: string }[];
  } catch {
    return unavailable();
  }
  if (!roles.length || !roles[0].role) return fail();

  // 3. MFA.
  const signingKey = process.env.ADMIN_MFA_ENCRYPTION_KEY ?? "";
  let mfaRows: { enabled?: boolean }[] = [];
  try {
    const mfaRes = await supaFetch(
      `/rest/v1/admin_mfa?user_id=eq.${userId}&select=enabled`,
      svcKey,
      true
    );
    if (!mfaRes.ok) return unavailable();
    mfaRows = (await mfaRes.json()) as { enabled?: boolean }[];
  } catch {
    return unavailable();
  }
  const mfaEnrolled = mfaRows.some((r) => r.enabled !== false);

  if (PUBLIC_PATHS.includes(pathname)) {
    // Sudah login penuh → jangan tampilkan halaman login lagi.
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (mfaEnrolled) {
    const mfaUser = await verifyMfaCookie(
      request.cookies.get("admfa")?.value,
      signingKey
    );
    if (mfaUser !== userId) {
      // Izinkan alur penyelesaian MFA saja.
      if (MFA_FLOW_PATHS.includes(pathname)) return NextResponse.next();
      return NextResponse.redirect(new URL("/mfa", request.url));
    }
  } else {
    // MFA wajib: paksa enrollment sebelum bisa ke mana-mana.
    if (!MFA_FLOW_PATHS.includes(pathname)) {
      return NextResponse.redirect(new URL("/mfa-setup", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Semua route kecuali aset statis.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|icons).*)",
  ],
};
