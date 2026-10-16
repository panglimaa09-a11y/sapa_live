"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase } from "../../../lib/supabase";
import EmptyState from "../../../components/EmptyState";

interface Report {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  created_at: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  reporter_name?: string;
  reported_name?: string;
}

interface UserRow {
  id: string;
  display_name: string;
  is_banned: boolean;
  is_admin: boolean;
  created_at: string;
}

interface CreatorRow {
  id: string;
  display_name: string;
  role: string | null;
  verification_status: string | null;
  creator_status: string | null;
  created_at: string;
}

interface WithdrawalRow {
  id: string;
  creator_id: string;
  amount: number;
  status: string;
  requested_at: string;
  creator_name?: string;
}

interface LedgerRow {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  created_at: string;
}

interface EarningRow {
  id: string;
  creator_id: string;
  status: string;
  created_at: string;
  creator_name?: string;
  net?: number;
}

type Tab = "reports" | "users" | "creators" | "withdrawals" | "ledger" | "earnings";

async function adminPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return res.ok && json?.ok;
}

export default function AdminPage() {
  const { t } = useLang();
  const { user, profile } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refInput, setRefInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !profile.is_admin) router.replace("/dashboard");
  }, [profile, router]);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb || !user) return;
      const { data: reps } = await sb
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (reps ?? []) as Report[];
      const ids = [...new Set(list.flatMap((r) => [r.reporter_id, r.reported_user_id]).filter(Boolean) as string[])];
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await sb.from("profiles").select("id, display_name").in("id", ids);
        for (const p of (profs ?? []) as { id: string; display_name: string }[]) names.set(p.id, p.display_name);
      }
      setReports(
        list.map((r) => ({
          ...r,
          reporter_name: r.reporter_id ? names.get(r.reporter_id) : undefined,
          reported_name: r.reported_user_id ? names.get(r.reported_user_id) : undefined,
        }))
      );
      const { data: ulist } = await sb
        .from("profiles")
        .select("id, display_name, is_banned, is_admin, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      setUsers((ulist ?? []) as UserRow[]);

      const { data: clist } = await sb
        .from("profiles")
        .select("id, display_name, role, verification_status, creator_status, created_at")
        .eq("role", "FEMALE")
        .order("created_at", { ascending: false })
        .limit(100);
      setCreators((clist ?? []) as CreatorRow[]);

      const { data: wlist } = await sb
        .from("withdrawals")
        .select("*")
        .in("status", ["REQUESTED", "PROCESSING"])
        .order("requested_at", { ascending: false })
        .limit(100);
      const wrows = (wlist ?? []) as WithdrawalRow[];
      const cids = [...new Set(wrows.map((w) => w.creator_id))];
      const cnames = new Map<string, string>();
      if (cids.length > 0) {
        const { data: cprofs } = await sb.from("profiles").select("id, display_name").in("id", cids);
        for (const p of (cprofs ?? []) as { id: string; display_name: string }[]) cnames.set(p.id, p.display_name);
      }
      setWithdrawals(wrows.map((w) => ({ ...w, creator_name: cnames.get(w.creator_id) })));

      const { data: llist } = await sb
        .from("token_ledger")
        .select("id, user_id, transaction_type, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setLedger((llist ?? []) as LedgerRow[]);

      const { data: elist } = await sb
        .from("creator_earnings")
        .select("*")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(100);
      const erows = ((elist ?? []) as Record<string, unknown>[]).map((e) => ({
        id: String(e.id),
        creator_id: String(e.creator_id ?? ""),
        status: String(e.status ?? ""),
        created_at: String(e.created_at ?? ""),
        net: Number(e.net_tokens ?? e.creator_net_amount ?? 0),
        creator_name: undefined as string | undefined,
      }));
      const eids = [...new Set(erows.map((e) => e.creator_id))];
      if (eids.length > 0) {
        const { data: eprofs } = await sb.from("profiles").select("id, display_name").in("id", eids);
        const emap = new Map(((eprofs ?? []) as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
        erows.forEach((e) => {
          e.creator_name = emap.get(e.creator_id);
        });
      }
      setEarnings(erows);
      setLoading(false);
    })();
  }, [user]);

  if (!profile?.is_admin) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-ink-soft">{t("common.loading")}</p>
      </div>
    );
  }

  const setStatus = async (id: string, status: string) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("reports").update({ status }).eq("id", id);
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const setBan = async (id: string, banned: boolean) => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("profiles").update({ is_banned: banned }).eq("id", id);
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, is_banned: banned } : u)));
  };

  const creatorAction = async (id: string, action: "approve" | "reject" | "suspend" | "activate") => {
    setBusy(id + action);
    try {
      const ok = await adminPost(`/api/admin/creator/${id}`, { action });
      if (ok) {
        setCreators((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  verification_status: action === "approve" ? "VERIFIED" : action === "reject" ? "REJECTED" : c.verification_status,
                  creator_status: action === "approve" ? "ACTIVE" : action === "suspend" ? "SUSPENDED" : action === "activate" ? "ACTIVE" : c.creator_status,
                }
              : c
          )
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const withdrawalAction = async (id: string, action: "approve" | "reject" | "mark_paid") => {
    setBusy(id + action);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "mark_paid") body.payment_reference = refInput[id] || undefined;
      if (action === "reject") body.failure_reason = refInput[id] || undefined;
      const ok = await adminPost(`/api/admin/withdrawals/${id}`, body);
      if (ok) setWithdrawals((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setBusy(null);
    }
  };

  const releaseEarning = async (earningId: string) => {
    setBusy(earningId);
    try {
      const ok = await adminPost("/api/admin/earnings/release", { earning_id: earningId });
      if (ok) setEarnings((prev) => prev.filter((e) => e.id !== earningId));
    } finally {
      setBusy(null);
    }
  };

  const tabs: { k: Tab; label: string }[] = [
    { k: "reports", label: t("admin.reports") },
    { k: "users", label: t("admin.users") },
    { k: "creators", label: t("admin.creators") },
    { k: "withdrawals", label: t("admin.withdrawals") },
    { k: "ledger", label: t("admin.ledger") },
    { k: "earnings", label: t("admin.earnings") },
  ];

  const btn = "rounded-full px-4 py-2 text-xs font-extrabold disabled:opacity-50";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("admin.title")}</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <button
            key={tb.k}
            onClick={() => setTab(tb.k)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
              tab === tb.k ? "bg-accent text-white" : "bg-white/5 text-ink-soft hover:bg-white/10"
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-sm text-ink-soft">{t("common.loading")}</p>}

      {!loading && tab === "reports" && (
        <div className="mt-6 space-y-3">
          {reports.filter((r) => r.status === "open").length === 0 && (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-surface">
              <EmptyState title={t("admin.reports")} text={t("admin.empty_reports")} />
            </div>
          )}
          {reports.map((r) => (
            <div key={r.id} className="rounded-[24px] border border-white/10 bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold">{r.reported_name ?? r.reported_user_id ?? "—"}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${r.status === "open" ? "bg-amber-400/15 text-amber-300" : "bg-white/5 text-ink-soft"}`}>
                  {r.status}
                </span>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-bold text-ink-soft">{t("admin.reason")}: </span>
                {r.reason}
              </p>
              {r.note && <p className="mt-1 text-sm text-ink-soft">{r.note}</p>}
              <p className="mt-1 text-xs text-ink-soft">
                {t("admin.reporter")}: {r.reporter_name ?? "—"} · {new Date(r.created_at).toLocaleString()}
              </p>
              {r.status === "open" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => void setStatus(r.id, "actioned")} className="rounded-full bg-accent px-4 py-2 text-xs font-extrabold text-white">
                    {t("admin.resolve")}
                  </button>
                  <button onClick={() => void setStatus(r.id, "dismissed")} className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink">
                    {t("admin.dismiss")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "users" && (
        <div className="mt-6 space-y-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-surface px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 font-extrabold text-accent">
                  {u.display_name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-bold">
                    {u.display_name}
                    {u.is_admin && (
                      <span className="ml-2 rounded-full bg-accent2/15 px-2 py-0.5 text-[10px] font-bold text-accent2">ADMIN</span>
                    )}
                    {u.is_banned && (
                      <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-300">BANNED</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">{new Date(u.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              {!u.is_admin && (
                <button
                  onClick={() => void setBan(u.id, !u.is_banned)}
                  className={`rounded-full px-4 py-2 text-xs font-extrabold ${u.is_banned ? "border border-white/15 text-ink-soft hover:text-ink" : "bg-red-600 text-white"}`}
                >
                  {u.is_banned ? t("admin.unban") : t("admin.ban")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "creators" && (
        <div className="mt-6 space-y-3">
          {creators.length === 0 && (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-surface">
              <EmptyState title={t("admin.creators")} text={t("admin.empty")} />
            </div>
          )}
          {creators.map((c) => (
            <div key={c.id} className="rounded-[24px] border border-white/10 bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold">{c.display_name}</p>
                <div className="flex gap-2">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-ink-soft">
                    {c.verification_status ?? "—"}
                  </span>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-ink-soft">
                    {c.creator_status ?? "—"}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{new Date(c.created_at).toLocaleString()}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button disabled={busy !== null} onClick={() => void creatorAction(c.id, "approve")} className={`${btn} bg-accent2 text-ink`}>
                  {t("admin.approve")}
                </button>
                <button disabled={busy !== null} onClick={() => void creatorAction(c.id, "reject")} className={`${btn} border border-white/15 text-ink-soft hover:text-ink`}>
                  {t("admin.reject")}
                </button>
                <button disabled={busy !== null} onClick={() => void creatorAction(c.id, "suspend")} className={`${btn} bg-red-600 text-white`}>
                  {t("admin.suspend")}
                </button>
                <button disabled={busy !== null} onClick={() => void creatorAction(c.id, "activate")} className={`${btn} border border-accent2/40 text-accent2`}>
                  {t("admin.activate")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "withdrawals" && (
        <div className="mt-6 space-y-3">
          {withdrawals.length === 0 && (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-surface">
              <EmptyState title={t("admin.withdrawals")} text={t("admin.empty")} />
            </div>
          )}
          {withdrawals.map((w) => (
            <div key={w.id} className="rounded-[24px] border border-white/10 bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold">
                  {w.creator_name ?? w.creator_id} · <span className="tabular-nums">{w.amount} token</span>
                </p>
                <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300">{w.status}</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{new Date(w.requested_at).toLocaleString()}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={refInput[w.id] ?? ""}
                  onChange={(e) => setRefInput((p) => ({ ...p, [w.id]: e.target.value }))}
                  placeholder={`${t("admin.payment_ref")} / ${t("admin.fail_reason")}`}
                  className="min-w-0 flex-1 rounded-2xl border-2 border-white/10 bg-base px-4 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button disabled={busy !== null} onClick={() => void withdrawalAction(w.id, "approve")} className={`${btn} bg-accent text-white`}>
                  {t("admin.approve")}
                </button>
                <button disabled={busy !== null} onClick={() => void withdrawalAction(w.id, "mark_paid")} className={`${btn} bg-accent2 text-ink`}>
                  {t("admin.mark_paid")}
                </button>
                <button disabled={busy !== null} onClick={() => void withdrawalAction(w.id, "reject")} className={`${btn} border border-white/15 text-ink-soft hover:text-ink`}>
                  {t("admin.reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "ledger" && (
        <div className="mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-surface">
          {ledger.length === 0 ? (
            <EmptyState title={t("admin.ledger")} text={t("admin.empty")} />
          ) : (
            <ul className="divide-y divide-white/5">
              {ledger.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{l.transaction_type}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {l.user_id.slice(0, 8)}… · {new Date(l.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className={`shrink-0 font-extrabold tabular-nums ${l.amount >= 0 ? "text-accent2" : "text-red-300"}`}>
                    {l.amount > 0 ? "+" : ""}{l.amount}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && tab === "earnings" && (
        <div className="mt-6 space-y-3">
          {earnings.length === 0 && (
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-surface">
              <EmptyState title={t("admin.earnings")} text={t("admin.empty")} />
            </div>
          )}
          {earnings.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-surface px-5 py-4">
              <div>
                <p className="font-bold">
                  {e.creator_name ?? e.creator_id} · <span className="tabular-nums">{e.net} token</span>
                </p>
                <p className="text-xs text-ink-soft">
                  {t("admin.status")}: {e.status} · {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
              <button
                disabled={busy === e.id}
                onClick={() => void releaseEarning(e.id)}
                className={`${btn} bg-accent text-white`}
              >
                {t("admin.release")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
