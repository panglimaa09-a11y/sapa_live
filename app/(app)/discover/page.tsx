// avoid-ai-design-ignore-file: SD4m (photo grid content, deliberate), K3 (badge over photo needs frosted legibility), SD8 (green dot = universal online convention, not accent)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Phone } from "@phosphor-icons/react";
import { useLang } from "../../../lib/i18n";
import EmptyState from "../../../components/EmptyState";

interface Creator {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  preferred_language: string | null;
  rate_tokens_per_interval: number;
  is_available: boolean;
  in_call: boolean;
}

type Status = "online" | "busy" | "offline";

function statusOf(c: Creator): Status {
  if (c.in_call) return "busy";
  if (c.is_available) return "online";
  return "offline";
}

const badgeStyle: Record<Status, string> = {
  online: "bg-black/55 text-emerald-300",
  busy: "bg-black/55 text-amber-300",
  offline: "bg-black/55 text-white/60",
};

const dotStyle: Record<Status, string> = {
  online: "bg-emerald-400",
  busy: "bg-amber-400",
  offline: "bg-white/40",
};

function Photo({ c }: { c: Creator }) {
  if (c.avatar_url) {
    return (
      <img
        src={c.avatar_url}
        alt={c.display_name}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    );
  }
  // Tanpa foto: inisial elegan — bukan foto palsu.
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent/40 via-surface to-accent2/30">
      <span className="text-6xl font-extrabold text-white/80">
        {c.display_name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function CreatorCard({ c }: { c: Creator }) {
  const { t } = useLang();
  const st = statusOf(c);
  const label =
    st === "online"
      ? t("discover.available")
      : st === "busy"
        ? t("discover.in_call")
        : t("discover.offline");
  return (
    <li className="group relative overflow-hidden rounded-3xl border border-white/10 bg-surface">
      <Link
        href={`/creator/${c.user_id}`}
        className="block aspect-[3/4] w-full"
        aria-label={`${c.display_name} — ${label}`}
      >
        <Photo c={c} />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30"
          aria-hidden
        />
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur ${badgeStyle[st]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dotStyle[st]}`} aria-hidden />
          {label}
        </span>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5">
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold tracking-tight text-white">
              {c.display_name}
            </p>
            <p className="mt-0.5 text-xs font-bold text-accent2 tabular-nums">
              {c.rate_tokens_per_interval} {t("discover.rate_unit")}
            </p>
          </div>
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform group-hover:scale-105"
            aria-hidden
          >
            <Phone size={20} weight="fill" />
          </span>
        </div>
      </Link>
    </li>
  );
}

export default function DiscoverPage() {
  const { t } = useLang();
  const [creators, setCreators] = useState<Creator[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/discover", { cache: "no-store" });
        if (!res.ok) throw new Error(`http-${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        if (json?.ok && Array.isArray(json.creators)) {
          setCreators(json.creators as Creator[]);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onlineCount = creators?.filter((c) => statusOf(c) === "online").length ?? 0;
  const ordered = creators
    ? [...creators].sort((a, b) => {
        const rank = (c: Creator) =>
          statusOf(c) === "online" ? 0 : statusOf(c) === "busy" ? 1 : 2;
        return rank(a) - rank(b);
      })
    : null;

  return (
    <div className="relative mx-auto max-w-4xl">
      <div className="relative pt-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent2">
          {t("discover.title")}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t("discover.title")}
        </h1>
        <p className="mt-2 max-w-[52ch] text-ink-soft">{t("discover.sub")}</p>
        {ordered && ordered.length > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent2/10 px-3.5 py-1.5 text-sm font-bold text-accent2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            {t("discover.online_count").replace("{n}", String(onlineCount))}
          </p>
        )}

        <div className="mt-6">
          {creators === null && !failed && (
            <p className="py-10 text-center text-sm text-ink-soft">{t("common.loading")}</p>
          )}
          {failed && (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
              <EmptyState title={t("common.error")} text={t("discover.unavailable_msg")} />
            </div>
          )}
          {ordered !== null && ordered.length === 0 && (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-surface">
              <EmptyState title={t("discover.title")} text={t("discover.empty")} />
            </div>
          )}
          {ordered !== null && ordered.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {ordered.map((c) => (
                <CreatorCard key={c.user_id} c={c} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
