// ============================================================================
// SERVER ONLY — jangan impor file ini dari client components.
// Berisi service_role key (bypass RLS). Hanya dipakai di route handlers.
// ============================================================================
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type Profile = {
  id: string;
  display_name: string | null;
  role: string | null;
  date_of_birth: string | null;
  language: string | null;
  age_verified: boolean | null;
  is_admin: boolean | null;
  is_banned: boolean | null;
  verification_status: string | null;
  creator_status: string | null;
  account_status: string | null;
  is_available: boolean | null;
};

/** Supabase client dengan service_role — bypass RLS. Server saja. */
export function getServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** User yang login (dari cookie sesi browser) + profilnya via service client. */
export async function getAuthedUser(): Promise<{
  user: { id: string; email?: string };
  profile: Profile | null;
} | null> {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const svc = getServiceClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { user: { id: user.id, email: user.email ?? undefined }, profile: (profile as Profile | null) ?? null };
}

/** Cek cepat kelayakan kreator (mirror fungsi SQL is_eligible_creator). */
export function isEligibleCreator(p: Profile | null): boolean {
  return (
    !!p &&
    p.role === "FEMALE" &&
    p.verification_status === "VERIFIED" &&
    p.creator_status === "ACTIVE" &&
    p.account_status === "ACTIVE"
  );
}

/** Cek akun male user layak memanggil. */
export function isActiveUser(p: Profile | null): boolean {
  return (
    !!p &&
    p.account_status === "ACTIVE" &&
    p.age_verified === true &&
    p.is_banned !== true
  );
}
