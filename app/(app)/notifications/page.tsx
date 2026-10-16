"use client";

import { useEffect, useState } from "react";
import { Bell, Checks } from "@phosphor-icons/react";
import { useLang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase } from "../../../lib/supabase";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const { t } = useLang();
  const { user } = useSession();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb || !user) {
        setLoading(false);
        return;
      }
      const { data } = await sb
        .from("notifications")
        .select("id, type, title, body, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setItems((data ?? []) as Notif[]);
      setLoading(false);
    })();
  }, [user]);

  const markAllRead = async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    await sb
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t("notifications.title")}
          </h1>
        </div>
        {items.some((n) => !n.read) && (
          <button
            onClick={() => void markAllRead()}
            className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ink-soft transition-colors hover:text-ink"
          >
            <Checks size={16} />
            {t("notifications.mark_read")}
          </button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {loading && <p className="text-sm text-ink-soft">{t("common.loading")}</p>}
        {!loading && items.length === 0 && (
          <p className="rounded-[24px] border border-white/10 bg-surface p-8 text-center text-sm text-ink-soft">
            {t("notifications.empty")}
          </p>
        )}
        {items.map((n) => (
          <div
            key={n.id}
            className={`flex items-start gap-3 rounded-[24px] border px-5 py-4 ${
              n.read
                ? "border-white/10 bg-surface"
                : "border-accent/40 bg-accent/5"
            }`}
          >
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                n.read ? "bg-white/5 text-ink-soft" : "bg-accent/15 text-accent"
              }`}
            >
              <Bell size={18} />
            </span>
            <div className="min-w-0">
              <p className="font-bold">{n.title}</p>
              {n.body && (
                <p className="mt-0.5 truncate text-sm text-ink-soft">{n.body}</p>
              )}
              <p className="mt-1 text-xs text-ink-soft">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
