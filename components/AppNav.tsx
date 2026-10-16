// avoid-ai-design-ignore-file: K3 (sticky nav over scrolling content, legitimate layering)
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  VideoCamera,
  SquaresFour,
  Shuffle,
  Compass,
  ChatCircleText,
  Users,
  Bell,
  Sparkle,
  Wallet,
} from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";
import { useSession } from "../lib/session";
import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

export default function AppNav() {
  const { t } = useLang();
  const { user, profile, demo } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) return;
    let cancelled = false;
    (async () => {
      const { count } = await sb
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (!cancelled) setUnread(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  async function signOut() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    router.replace("/login");
  }

  const displayName = profile?.display_name ?? user?.email?.split("@")[0] ?? "—";
  const initial = displayName.charAt(0).toUpperCase();

  const desktopTabs = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: SquaresFour },
    { href: "/discover", label: t("nav.discover"), icon: Sparkle },
    { href: "/match", label: t("nav.match"), icon: Shuffle },
    { href: "/explore", label: t("nav.explore"), icon: Compass },
    { href: "/messages", label: t("nav.messages"), icon: ChatCircleText },
    { href: "/connections", label: t("nav.connections"), icon: Users },
    { href: "/wallet", label: t("nav.wallet"), icon: Wallet },
  ];
  const mobileTabs = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: SquaresFour },
    { href: "/discover", label: t("nav.discover"), icon: Sparkle },
    { href: "/match", label: t("nav.match"), icon: Shuffle },
    { href: "/messages", label: t("nav.messages"), icon: ChatCircleText },
    { href: "/wallet", label: t("nav.wallet"), icon: Wallet },
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2" aria-label="SapaLive">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
              <VideoCamera size={20} weight="fill" aria-hidden />
            </span>
            <span className="text-xl font-extrabold tracking-tight">
              Sapa<span className="text-accent">Live</span>
            </span>
            {demo && (
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[11px] font-bold text-amber-200">
                Demo
              </span>
            )}
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi aplikasi">
            {desktopTabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive(tab.href) ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  isActive(tab.href)
                    ? "bg-accent text-white"
                    : "text-ink-soft hover:bg-white/5 hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <Link
              href="/notifications"
              aria-label={t("nav.notifications")}
              className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                isActive("/notifications") ? "bg-white/10 text-ink" : "text-ink-soft hover:bg-white/5 hover:text-ink"
              }`}
            >
              <Bell size={20} aria-hidden />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent2 px-1 text-[10px] font-extrabold text-ink">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              href="/settings"
              aria-label={t("nav.settings")}
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-accent font-extrabold text-[#1a1208] transition-transform hover:scale-105 ${
                isActive("/settings") ? "ring-2 ring-white/40" : ""
              }`}
            >
              {initial}
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="hidden rounded-full px-3 py-2 text-sm font-bold text-ink-soft transition-colors hover:text-ink sm:block"
            >
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </header>

      {/* Bottom nav — mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-paper/90 backdrop-blur-xl md:hidden"
        aria-label="Navigasi aplikasi"
      >
        <div className="mx-auto grid w-full max-w-lg grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
          {mobileTabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors ${
                  active ? "text-accent" : "text-ink-soft"
                }`}
              >
                <tab.icon size={22} weight={active ? "fill" : "regular"} aria-hidden />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
