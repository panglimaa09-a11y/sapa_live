import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anon);

export function getSupabase() {
  if (!supabaseConfigured) return null;
  return createBrowserClient(url as string, anon as string);
}
