// avoid-ai-design-ignore-file: L1 (centered single-action app screen, deliberate)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coins, Clock, ChatCircleText, VideoCamera, Compass, Users, Wallet, Sparkle } from "@phosphor-icons/react";
import { useLang, usePageTitle } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase } from "../../../lib/supabase";
import EmptyState from "../../../components/EmptyState";

type Recent = { id: string; displayName: string; endedAt: string | null };

export default function DashboardPage() {
  const { t } = useLang();
  usePageTitle(t("nav.dashboard"));
  const { user, profile, demo } = useSession();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ conversations: 0, minutes: 0, tokens: 0 });
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [callsRes, walletRes, recentRes] = await Promise.all([
        sb.from("calls").select("id,requested_at,ended_at,billable_duration_seconds", { count: "exact" }).eq("male_user_id", user.id),
        sb.from("wallets").select("tokens").eq("user_id", user.id).maybeSingle(),
        sb
          .from("calls")
          .select("id,ended_at,female_creator_id")
          .eq("male_user_id", user.id)
          .order("ended_at", { ascending: false })
          .limit(5),
      ]);
      if (cancelled) return;
      const rows = (callsRes.data ?? []) as { requested_at: string; ended_at: string | null; billable_duration_seconds: number }[];
      const minutes = rows.reduce((acc, r) => acc + Math.round((r.billable_duration_seconds ?? 0) / 60), 0);
      setStats({
        conversations: callsRes.count ?? 0,
        minutes,
        tokens: (walletRes.data as { tokens: number } | null)?.tokens ?? 0,
      });
      const recentList = (recentRes.data ?? []) as { id: string; ended_at: string | null; female_creator_id: string }[];
      const peerIds = [...new Set(recentList.map((r) => r.female_creator_id).filter(Boolean))];
      const peerNames = new Map<string, string>();
      if (peerIds.length > 0) {
        const { data: pp } = await sb.from("public_profiles").select("id, display_name").in("id", peerIds);
        for (const p of (pp ?? []) as { id: string; display_name: string }[]) peerNames.set(p.id, p.display_name);
      }
      setRecent(
        recentList.map((r) => ({
          id: r.id,
          displayName: peerNames.get(r.female_creator_id) ?? "—",
          endedAt: r.ended_at,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const name = profile?.display_name ?? user?.email?.split("@")[0] ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 11 ? t("dashboard.greet_morning") : hour < 18 ? t("dashboard.greet_day") : t("dashboard.greet_night");

  const statCards = [
    { icon: VideoCamera, value: stats.conversations, label: t("dashboard.stat_matches") },
    { icon: Clock, value: stats.minutes, label: t("dashboard.stat_minutes") },
    { icon: Coins, value: stats.tokens, label: t("dashboard.stat_tokens") },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <section className="pt-10">
        <p className="text-sm font-semibold text-ink-soft">
          {greeting}
          {name ? `, ${name}` : ""}
        </p>
        <h1 className="mt-2 font-display text-[clamp(2.6rem,9vw,4rem)] leading-[1.02] tracking-tight font-semibold">
          {t("dashboard.title")}
        </h1>
        <p className="mt-3 max-w-[46ch] text-ink-soft">{t("dashboard.sub")}</p>
        <Link
          href="/match"
          className="group mt-8 inline-flex items-center gap-3 rounded-2xl bg-accent px-9 py-4 text-lg font-extrabold text-[#1a1208] transition-transform hover:-translate-y-0.5"
        >
          {t("dashboard.quick_match")}
          <ArrowRight size={22} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-1" />
        </Link>
        {demo && (
          <p className="mt-4 max-w-[52ch] text-xs leading-relaxed text-amber-200/80">
            {t("demo.note")}
          </p>
        )}
      </section>

      <section className="mt-12" aria-label={t("dashboard.stats_label")}>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="rounded-3xl border border-white/10 bg-surface p-4 sm:p-6"
            >
              <s.icon size={22} weight="duotone" aria-hidden className="text-accent" />
              <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl">
                {loading ? "–" : s.value}
              </p>
              <p className="mt-1 text-xs font-semibold text-ink-soft sm:text-sm">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10" aria-label={t("dashboard.quick_links")}>
        <h2 className="font-display text-3xl tracking-tight font-semibold">{t("dashboard.quick_links")}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { href: "/explore", label: t("nav.explore"), icon: Compass },
            { href: "/connections", label: t("nav.connections"), icon: Users },
            { href: "/wallet", label: t("nav.wallet"), icon: Wallet },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex flex-col items-start gap-3 rounded-3xl border border-white/10 bg-surface p-5 transition-colors hover:border-accent/50"
            >
              <l.icon size={26} weight="duotone" aria-hidden className="text-accent" />
              <span className="text-sm font-extrabold">{l.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {profile?.role === "FEMALE" && (
        <section className="mt-6" aria-label={t("dashboard.creator_title")}>
          <div className="flex items-center gap-4 overflow-hidden rounded-3xl border border-accent/25 bg-surface p-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Sparkle size={28} weight="fill" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">
                {profile.creator_status === "ACTIVE" ? t("dashboard.creator_title") : t("dashboard.become_title")}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {profile.creator_status === "ACTIVE" ? t("dashboard.creator_text") : t("dashboard.become_text")}
              </p>
            </div>
            <Link
              href={profile.creator_status === "ACTIVE" ? "/creator/dashboard" : "/creator/onboarding"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-accent px-5 py-2.5 text-sm font-extrabold text-[#1a1208]"
            >
              {profile.creator_status === "ACTIVE" ? t("dashboard.creator_cta") : t("dashboard.become_cta")}
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          </div>
        </section>
      )}

      <section className="mt-10" aria-label={t("dashboard.recent_label")}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-3xl tracking-tight font-semibold">{t("dashboard.recent")}</h2>
          <Link
            href="/connections"
            className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:underline"
          >
            {t("dashboard.view_all")}
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-surface">
          {recent.length === 0 ? (
            <EmptyState
              title={t("dashboard.empty_title")}
              text={t("dashboard.empty_text")}
              action={
                <Link
                  href="/match"
                  className="inline-flex items-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-extrabold text-[#1a1208]"
                >
                  <ChatCircleText size={18} weight="bold" aria-hidden />
                  {t("dashboard.quick_match")}
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-white/5">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-4 px-5 py-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/20 text-lg font-extrabold text-accent">
                    {r.displayName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{r.displayName}</p>
                    <p className="text-sm text-ink-soft">
                      {r.endedAt ? new Date(r.endedAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Link
                    href="/messages"
                    className="rounded-full bg-white/5 px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-white/10"
                  >
                    {t("dashboard.chat")}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
