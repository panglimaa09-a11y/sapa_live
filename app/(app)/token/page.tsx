"use client";

import { useEffect, useState } from "react";
import { Coins } from "@phosphor-icons/react";
import { useLang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase, supabaseConfigured } from "../../../lib/supabase";
import { getWallet, getTransactions, type TxRow } from "../../../lib/wallet";

export default function TokenPage() {
  const { t, lang } = useLang();
  const { user } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb || !user) {
        setLoading(false);
        return;
      }
      const w = await getWallet(user.id);
      setBalance(w?.tokens ?? 0);
      setTxs(await getTransactions(user.id));
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t("nav.tokens")}
      </h1>

      <div className="mt-6 rounded-[28px] border border-white/10 bg-surface p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent2/15 text-accent2">
          <Coins size={32} weight="fill" />
        </span>
        {!supabaseConfigured ? (
          <p className="mt-4 text-sm text-ink-soft">{t("match.demo_note")}</p>
        ) : (
          <p className="mt-4 text-5xl font-extrabold tracking-tight">
            {loading ? "—" : balance}
          </p>
        )}
      </div>

      <h2 className="mt-8 text-xl font-extrabold tracking-tight">
        {lang === "id" ? "Riwayat" : "History"}
      </h2>
      <div className="mt-4 space-y-2">
        {txs.length === 0 && !loading && (
          <p className="rounded-[24px] border border-white/10 bg-surface p-6 text-center text-sm text-ink-soft">
            {lang === "id" ? "Belum ada transaksi." : "No transactions yet."}
          </p>
        )}
        {txs.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between rounded-[20px] border border-white/10 bg-surface px-5 py-3.5"
          >
            <div>
              <p className="text-sm font-bold">{tx.kind}</p>
              <p className="text-xs text-ink-soft">
                {new Date(tx.created_at).toLocaleString()}
              </p>
            </div>
            <p
              className={`font-extrabold ${tx.amount >= 0 ? "text-accent2" : "text-ink"}`}
            >
              {tx.amount >= 0 ? "+" : ""}
              {tx.amount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
