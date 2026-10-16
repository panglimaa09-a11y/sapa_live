"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, PhoneCall, Clock, PhoneDisconnect } from "@phosphor-icons/react";
import { useLang, usePageTitle } from "../../../../lib/i18n";
import { useSession } from "../../../../lib/session";
import { getSupabase } from "../../../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import EmptyState from "../../../../components/EmptyState";

interface CallRow {
  id: string;
  male_user_id: string;
  status: string;
  requested_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  billable_duration_seconds: number | null;
  caller_name?: string;
}

function netOf(e: Record<string, unknown>): number {
  const v = e.net_tokens ?? e.creator_net_amount ?? e.net_amount ?? 0;
  return typeof v === "number" ? v : Number(v) || 0;
}

export default function CreatorDashboardPage() {
  const { t } = useLang();
  usePageTitle(t("call.female_title"));
  const { user, profile, refresh } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(0);
  const [pending, setPending] = useState(0);
  const [available, setAvailable] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [isAvailable, setIsAvailable] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [incoming, setIncoming] = useState<CallRow[]>([]);
  const [history, setHistory] = useState<CallRow[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const chRef = useRef<RealtimeChannel | null>(null);

  const isCreator =
    profile?.role === "FEMALE" &&
    profile?.verification_status === "VERIFIED" &&
    profile?.creator_status === "ACTIVE";

  const enrichNames = useCallback(async (rows: CallRow[]) => {
    const sb = getSupabase();
    if (!sb || rows.length === 0) return rows;
    const ids = [...new Set(rows.map((r) => r.male_user_id))];
    const { data } = await sb.from("public_profiles").select("id, display_name").in("id", ids);
    const map = new Map(((data ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
    return rows.map((r) => ({ ...r, caller_name: map.get(r.male_user_id) ?? "—" }));
  }, []);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) {
      setLoading(false);
      return;
    }
    setIsAvailable(!!profile?.is_available);

    const [earnRes, callsRes, incomingRes] = await Promise.all([
      sb.from("creator_earnings").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(200),
      sb.from("calls").select("id, male_user_id, status, requested_at, accepted_at, ended_at, billable_duration_seconds").eq("female_creator_id", user.id).order("requested_at", { ascending: false }).limit(50),
      sb.from("calls").select("id, male_user_id, status, requested_at, accepted_at, ended_at, billable_duration_seconds").eq("female_creator_id", user.id).eq("status", "REQUESTED").order("requested_at", { ascending: false }),
    ]);

    const earns = ((earnRes.data ?? []) as Record<string, unknown>[]);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    let t = 0, p = 0, a = 0;
    for (const e of earns) {
      const n = netOf(e);
      const st = String(e.status ?? "").toUpperCase();
      if (st === "PENDING") p += n;
      if (st === "AVAILABLE") a += n;
      const created = e.created_at ? new Date(String(e.created_at)).getTime() : 0;
      if (created >= dayStart.getTime() && st !== "REVERSED") t += n;
    }
    setToday(t);
    setPending(p);
    setAvailable(a);

    const calls = ((callsRes.data ?? []) as CallRow[]);
    const doneCalls = calls.filter((c) => ["COMPLETED", "ENDED"].includes(String(c.status).toUpperCase()));
    setTotalCalls(doneCalls.length);
    setTotalMinutes(
      Math.round(doneCalls.reduce((acc, c) => acc + (c.billable_duration_seconds ?? 0), 0) / 60)
    );
    setHistory(await enrichNames(calls.filter((c) => String(c.status).toUpperCase() !== "REQUESTED").slice(0, 20)));
    setIncoming(await enrichNames((incomingRes.data ?? []) as CallRow[]));
    setLoading(false);
  }, [user, profile, enrichNames]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) return;
    if (chRef.current) void sb.removeChannel(chRef.current);
    const ch = sb
      .channel(`incoming-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `female_creator_id=eq.${user.id}` },
        () => {
          void load();
        }
      )
      .subscribe();
    chRef.current = ch;
    return () => {
      if (sb) void sb.removeChannel(ch);
    };
  }, [user, load]);

  const toggleAvailability = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/creator/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ is_available: !isAvailable }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setIsAvailable(!isAvailable);
        await refresh();
      }
    } finally {
      setToggling(false);
    }
  };

  const respond = async (callId: string, action: "accept" | "decline") => {
    const res = await fetch(`/api/calls/${callId}/${action}`, { method: "POST" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) {
      if (action === "accept") {
        router.push(`/call/${callId}?callId=${callId}`);
      } else {
        setIncoming((prev) => prev.filter((c) => c.id !== callId));
      }
    }
  };

  const requestWithdraw = async () => {
    const amount = Math.floor(Number(withdrawAmount));
    setWithdrawMsg("");
    if (!amount || amount <= 0 || amount > available) return;
    setWithdrawBusy(true);
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
      }
    } finally {
      setWithdrawBusy(false);
    }
  };

  if (!loading && !isCreator) {
    return (
      <div className="mx-auto max-w-md py-16">
        <div className="rounded-[28px] border border-white/10 bg-surface p-8 text-center">
          <p className="text-lg font-extrabold">{t("cdash.not_creator")}</p>
          <Link href="/creator/onboarding" className="mt-6 inline-block rounded-full bg-accent px-8 py-3.5 font-extrabold text-white">
            {t("cdash.become")}
          </Link>
        </div>
      </div>
    );
  }

  const widgets = [
    { label: t("cdash.earnings_today"), value: `${today} ${t("cdash.token_unit")}`, icon: Coins },
    { label: t("cdash.pending"), value: `${pending} ${t("cdash.token_unit")}`, icon: Clock },
    { label: t("cdash.available"), value: `${available} ${t("cdash.token_unit")}`, icon: Coins },
    { label: t("cdash.total_calls"), value: String(totalCalls), icon: PhoneCall },
    { label: t("cdash.total_duration"), value: `${totalMinutes} ${t("cdash.minutes")}`, icon: Clock },
  ];

  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-accent2/10 blur-3xl" aria-hidden />

      <div className="relative pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("cdash.title")}</h1>
          <label className="flex cursor-pointer items-center gap-3 rounded-full border border-white/10 bg-surface px-5 py-3">
            <span className="text-sm font-extrabold">{t("cdash.availability")}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isAvailable}
              disabled={toggling}
              onClick={() => void toggleAvailability()}
              className={`relative h-7 w-12 rounded-full transition-colors ${isAvailable ? "bg-accent2" : "bg-white/15"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${isAvailable ? "left-6" : "left-1"}`}
              />
            </button>
          </label>
        </div>
        <p className="mt-2 max-w-[60ch] text-xs leading-relaxed text-ink-soft">{t("cdash.availability_note")}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {widgets.map((w) => (
            <div key={w.label} className="rounded-3xl border border-white/10 bg-surface p-4 text-center">
              <w.icon size={20} weight="duotone" aria-hidden className="mx-auto text-accent2" />
              <p className="mt-2 text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">
                {loading ? "–" : w.value}
              </p>
              <p className="mt-1 text-xs font-bold text-ink-soft">{w.label}</p>
            </div>
          ))}
        </div>

        <section className="mt-10" aria-label={t("cdash.incoming")}>
          <h2 className="text-xl font-extrabold tracking-tight">{t("cdash.incoming")}</h2>
          <div className="mt-4 space-y-3">
            {incoming.length === 0 && (
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
                <EmptyState title={t("cdash.incoming")} text={t("cdash.no_incoming")} />
              </div>
            )}
            {incoming.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-[24px] border border-accent2/30 bg-surface px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent2/15 font-extrabold text-accent2">
                    {(c.caller_name ?? "?").charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-bold">{c.caller_name ?? "—"}</p>
                    <p className="text-xs text-ink-soft">{new Date(c.requested_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void respond(c.id, "decline")}
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/15 text-ink-soft hover:text-ink"
                    aria-label={t("cdash.decline")}
                  >
                    <PhoneDisconnect size={20} />
                  </button>
                  <button
                    onClick={() => void respond(c.id, "accept")}
                    className="flex h-11 items-center gap-2 rounded-full bg-accent2 px-5 font-extrabold text-ink"
                  >
                    <PhoneCall size={18} weight="fill" aria-hidden />
                    {t("cdash.accept")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-label={t("cdash.withdraw")}>
          <h2 className="text-xl font-extrabold tracking-tight">{t("cdash.withdraw")}</h2>
          <div className="mt-4 rounded-[28px] border border-white/10 bg-surface p-5">
            <p className="text-sm text-ink-soft">
              {t("cdash.available")}: <span className="font-extrabold text-ink tabular-nums">{available}</span> {t("cdash.token_unit")}
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

        <section className="mt-10" aria-label={t("cdash.history")}>
          <h2 className="text-xl font-extrabold tracking-tight">{t("cdash.history")}</h2>
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-surface">
            {history.length === 0 ? (
              <EmptyState title={t("cdash.history")} text={t("cdash.no_history")} />
            ) : (
              <ul className="divide-y divide-white/5">
                {history.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 font-extrabold text-accent">
                      {(c.caller_name ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{c.caller_name ?? "—"}</p>
                      <p className="text-xs text-ink-soft">
                        {new Date(c.requested_at).toLocaleString()}
                        {c.billable_duration_seconds != null &&
                          ` · ${Math.round(c.billable_duration_seconds / 60)} ${t("cdash.minutes")}`}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-ink-soft">
                      {c.status}
                    </span>
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
