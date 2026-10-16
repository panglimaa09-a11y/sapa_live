// ============================================================================
// SERVER ONLY — service_role key (bypass RLS). Jangan impor dari client.
// ============================================================================
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function supabaseUrl(): string {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) throw new Error("SUPABASE_URL belum dikonfigurasi");
  return url;
}

/** Client service_role — bypass RLS. Hanya untuk operasi admin terotorisasi. */
export function getServiceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi");
  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Client anon terikat cookie sesi browser (untuk login / getUser). */
export async function getSessionClient() {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!anon) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY belum dikonfigurasi");
  const store = await cookies();
  return createServerClient(supabaseUrl(), anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value, options }) => {
          store.set(name, value, options);
        });
      },
    },
  });
}
