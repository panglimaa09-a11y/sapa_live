"use client";

/**
 * Dompet token SapaLive — data nyata dari Supabase.
 * Tanpa Supabase: tampilkan status belum dikonfigurasi (tanpa angka palsu).
 */
import { getSupabase } from "./supabase";

export interface WalletRow {
  tokens: number;
  free_used?: number;
  free_date?: string;
  updated_at: string;
}

export interface TxRow {
  id: string;
  kind: string;
  amount: number;
  created_at: string;
}

export async function getWallet(
  userId: string
): Promise<WalletRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("wallets")
    .select("tokens, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as WalletRow;
}

export async function getTransactions(
  userId: string
): Promise<TxRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("token_transactions")
    .select("id, kind, amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as TxRow[];
}
