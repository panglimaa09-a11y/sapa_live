"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatCircleText, Flag } from "@phosphor-icons/react";
import { useLang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase } from "../../../lib/supabase";

interface Conn {
  id: string;
  started_at: string;
  duration_sec: number | null;
  other_id: string;
  other_name: string;
}

export default function ConnectionsPage() {
  const { t } = useLang();
  const { user } = useSession();
  const [rows, setRows] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb || !user) {
        setLoading(false);
        return;
      }
      const { data } = await sb
        .from("matches")
        .select("id, started_at, duration_sec, user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("started_at", { ascending: false });
      const list = (data ?? []) as {
        id: string;
        started_at: string;
        duration_sec: number | null;
        user_a: string;
        user_b: string;
      }[];
      const otherIds = [...new Set(list.map((r) => (r.user_a === user.id ? r.user_b : r.user_a)))];
      const names = new Map<string, string>();
      if (otherIds.length > 0) {
        // Nama peer diambil dari view publik (base profiles kini owner-only).
        const { data: profs } = await sb
          .from("public_profiles")
          .select("id, display_name")
          .in("id", otherIds);
        for (const p of (profs ?? []) as { id: string; display_name: string }[]) {
          names.set(p.id, p.display_name);
        }
      }
      setRows(
        list.map((r) => {
          const oid = r.user_a === user.id ? r.user_b : r.user_a;
          return {
            id: r.id,
            started_at: r.started_at,
            duration_sec: r.duration_sec,
            other_id: oid,
            other_name: names.get(oid) ?? "?",
          };
        })
      );
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t("connections.title")}
      </h1>
      <p className="mt-2 text-ink-soft">{t("connections.sub")}</p>

      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-ink-soft">{t("common.loading")}</p>}
        {!loading && rows.length === 0 && (
          <p className="rounded-[24px] border border-white/10 bg-surface p-8 text-center text-sm text-ink-soft">
            {t("connections.empty")}
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-surface px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 font-extrabold text-accent">
                {r.other_name.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-bold">{r.other_name}</p>
                <p className="text-xs text-ink-soft">
                  {new Date(r.started_at).toLocaleString()}
                  {r.duration_sec != null &&
                    ` · ${Math.max(1, Math.round(r.duration_sec / 60))} ${t("connections.min")}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/messages?m=${r.id}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-ink-soft transition-colors hover:bg-accent hover:text-white"
                aria-label={t("connections.chat")}
              >
                <ChatCircleText size={20} />
              </Link>
              <Link
                href={`/messages?m=${r.id}`}
                className="hidden rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink sm:block"
              >
                <Flag size={14} className="mr-1 inline" />
                {t("match.report")}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
