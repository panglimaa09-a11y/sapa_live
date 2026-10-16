"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Coins, XCircle } from "@phosphor-icons/react";
import { useLang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase } from "../../../lib/supabase";
import { getWallet } from "../../../lib/wallet";
import EmptyState from "../../../components/EmptyState";

interface Pkg {
  id: string;
  tokens: number;
  idr: number;
}

interface LedgerRow {
  id: string;
  transaction_type: string;
  amount: number;
  created_at: string;
}

type OrderState = "idle" | "polling" | "paid" | "expired" | "failed";

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export default function WalletPage() {
  const { t } = useLang();
  const { user, profile } = useSession();
  const isFemale = profile?.role === "FEMALE";
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order_id");

  const [balance, setBalance] = useState<number | null>(null);
  const [packages, setPackages] = useState<Pkg[] | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [orderState, setOrderState] = useState<OrderState>("idle");
  const [credited, setCredited] = useState(0);
  const [available, setAvailable] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [buyError, setBuyError] = useState("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    const sb = getSupabase();
    if (sb && user) {
      const w = await getWallet(user.id);
      setBalance(w?.tokens ?? 0);
      const { data } = await sb
        .from("token_ledger")
        .select("id, transaction_type, amount, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setLedger((data ?? []) as LedgerRow[]);
      if (profile?.role === "FEMALE") {
        const { data: earns } = await sb
          .from("creator_earnings")
          .select("net_tokens")
          .eq("creator_id", user.id)
          .eq("status", "AVAILABLE");
        setAvailable(
          ((earns ?? []) as { net_tokens: number }[]).reduce(
            (s, e) => s + (Number(e.net_tokens) || 0),
            0
          )
        );
      }
    }
    try {
      const res = await fetch("/api/topup/packages", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      setPackages(res.ok && json?.ok && Array.isArray(json.packages) ? (json.packages as Pkg[]) : []);
    } catch {
      setPackages([]);
    }
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!orderId) return;
    setOrderState("polling");
    const check = async () => {
      try {
        const res = await fetch(`/api/topup/status?order_id=${encodeURIComponent(orderId)}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const status = String(json?.status ?? "").toUpperCase();
        if (status === "PAID" || status === "COMPLETED" || status === "SUCCESS") {
          if (poll.current) clearInterval(poll.current);
          setCredited(Number(json?.tokens_credited ?? 0));
          setOrderState("paid");
          void loadAll();
        } else if (status === "EXPIRED") {
          if (poll.current) clearInterval(poll.current);
          setOrderState("expired");
        } else if (status === "FAILED" || status === "CANCELLED") {
          if (poll.current) clearInterval(poll.current);
          setOrderState("failed");
        }
      } catch {
        /* coba lagi */
      }
    };
    void check();
    poll.current = setInterval(check, 4000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [orderId, loadAll]);

  const buy = async (pkg: Pkg) => {
    setBuying(pkg.id);
    setBuyError("");
    try {
      const res = await fetch("/api/topup/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ package_id: pkg.id }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && json.payment_link) {
        window.location.href = String(json.payment_link);
        return;
      }
      setBuyError(
        json?.error === "TOPUP_UNCONFIGURED"
          ? t("wallet.unavailable")
          : t("common.error")
      );
    } catch {
      setBuyError(t("common.error"));
    } finally {
      setBuying(null);
    }
  };

  const requestWithdraw = async () => {
    const amount = Math.floor(Number(withdrawAmount));
    if (!(amount > 0) || amount > available) return;
    setWithdrawBusy(true);
    setWithdrawMsg("");
    try {
      const res = await fetch("/api/withdrawals/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_tokens: amount }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setWithdrawMsg(t("cdash.withdraw_sent"));
        setWithdrawAmount("");
        void loadAll();
      } else {
        setWithdrawMsg(t("common.error"));
      }
    } finally {
      setWithdrawBusy(false);
    }
  };

  const txStyle = (kind: string) => {
    const k = kind.toUpperCase();
    if (k.includes("TOPUP") || k.includes("CREDIT") || k.includes("BONUS"))
      return "text-accent2";
    if (k.includes("DEBIT") || k.includes("CALL") || k.includes("SPEND"))
      return "text-red-300";
    return "text-ink-soft";
  };

  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-accent2/10 blur-3xl" aria-hidden />

      <div className="relative pt-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("wallet.title")}</h1>

        {orderId && orderState !== "idle" && (
          <div
            className={`mt-6 flex items-center gap-3 rounded-[24px] border p-5 ${
              orderState === "paid"
                ? "border-accent2/30 bg-accent2/5"
                : orderState === "polling"
                  ? "border-white/10 bg-surface"
                  : "border-red-500/30 bg-red-500/5"
            }`}
            role="status"
          >
            {orderState === "paid" && <CheckCircle size={28} weight="fill" aria-hidden className="shrink-0 text-accent2" />}
            {orderState === "polling" && (
              <div className="h-7 w-7 shrink-0 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
            )}
            {(orderState === "expired" || orderState === "failed") && (
              <XCircle size={28} weight="fill" aria-hidden className="shrink-0 text-red-300" />
            )}
            <p className="text-sm font-bold">
              {orderState === "polling" && t("wallet.waiting_payment")}
              {orderState === "paid" && t("wallet.paid").replace("{n}", String(credited))}
              {orderState === "expired" && t("wallet.expired")}
              {orderState === "failed" && t("wallet.failed")}
            </p>
          </div>
        )}

        <div className="mt-6 rounded-[32px] border border-white/10 bg-surface p-8 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent2/15 text-accent2">
            <Coins size={32} weight="fill" aria-hidden />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink-soft">{t("wallet.balance")}</p>
          <p className="mt-1 text-5xl font-extrabold tracking-tight tabular-nums">
            {loading ? "–" : (balance ?? 0)}
          </p>
        </div>

        {isFemale ? (
          <section className="mt-10" aria-label={t("cdash.withdraw")}>
            <h2 className="text-xl font-extrabold tracking-tight">{t("cdash.withdraw")}</h2>
            <div className="mt-4 rounded-[28px] border border-white/10 bg-surface p-5">
              <p className="text-sm text-ink-soft">
                {t("cdash.available")}:{" "}
                <span className="font-extrabold text-ink tabular-nums">{available}</span>{" "}
                {t("cdash.token_unit")}
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={available}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={t("cdash.withdraw_amount")}
                  className="flex-1 rounded-2xl border-2 border-white/10 bg-base px-4 py-3 text-[15px] font-semibold text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => void requestWithdraw()}
                  disabled={withdrawBusy || !withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > available}
                  className="rounded-2xl bg-accent px-6 py-3 text-sm font-extrabold text-white disabled:opacity-40"
                >
                  {t("cdash.withdraw")}
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-soft">{t("cdash.withdraw_hint")}</p>
              {withdrawMsg && <p className="mt-2 text-sm font-bold text-accent2">{withdrawMsg}</p>}
            </div>
          </section>
        ) : (
        <section className="mt-10" aria-label={t("wallet.topup")}>
          <h2 className="text-xl font-extrabold tracking-tight">{t("wallet.topup")}</h2>
          <p className="mt-1 text-xs text-ink-soft">{t("wallet.packages_note")}</p>
          {buyError && (
            <p className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
              {buyError}
            </p>
          )}
          <div className="mt-4">
            {packages === null && <p className="text-sm text-ink-soft">{t("common.loading")}</p>}
            {packages !== null && packages.length === 0 && (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
                <EmptyState title={t("wallet.topup")} text={t("discover.unavailable_msg")} />
              </div>
            )}
            {packages !== null && packages.length > 0 && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {packages.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-surface px-5 py-4"
                  >
                    <div>
                      <p className="text-xl font-extrabold tabular-nums">{p.tokens} token</p>
                      <p className="text-sm font-bold text-accent2">{idr(p.idr)}</p>
                    </div>
                    <button
                      onClick={() => void buy(p)}
                      disabled={buying !== null}
                      className="rounded-full bg-accent px-6 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                    >
                      {buying === p.id ? t("wallet.processing") : t("wallet.buy")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        )}

        <section className="mt-10" aria-label={t("wallet.history")}>
          <h2 className="text-xl font-extrabold tracking-tight">{t("wallet.history")}</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-surface">
            {ledger.length === 0 ? (
              <EmptyState title={t("wallet.history")} text={t("wallet.no_history")} />
            ) : (
              <ul className="divide-y divide-white/5">
                {ledger.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="text-sm font-bold">{row.transaction_type}</p>
                      <p className="text-xs text-ink-soft">{new Date(row.created_at).toLocaleString()}</p>
                    </div>
                    <p className={`font-extrabold tabular-nums ${txStyle(row.transaction_type)}`}>
                      {row.amount > 0 ? "+" : ""}{row.amount}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
