"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PresenceMeta } from "../lib/matchmaking";
import { useLang } from "../lib/i18n";

/**
 * Indikator live di hero — DATA NYATA via presence.
 * Disembunyikan saat 0 agar tidak memberi kesan layanan sepi.
 */
export default function LiveCounter() {
  const { t } = useLang();
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let ch: RealtimeChannel | null = null;
    const update = () => {
      if (!ch) return;
      const state = ch.presenceState<PresenceMeta>();
      let n = 0;
      for (const metas of Object.values(state)) {
        for (const m of metas) if (m.status === "searching") n++;
      }
      setOnline(n);
    };
    ch = sb.channel("sapalive-lobby", {
      config: { presence: { key: `lc-${Math.random()}` } },
    });
    ch.on("presence", { event: "sync" }, update);
    void ch.subscribe((s) => {
      if (s === "SUBSCRIBED") update();
    });
    const iv = setInterval(update, 5000);
    return () => {
      clearInterval(iv);
      if (ch && sb) void sb.removeChannel(ch);
    };
  }, []);

  if (online === null || online === 0) return null;
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf" />
      </span>
      <strong className="font-bold text-ink tabular-nums">
        <span className="tabular-nums">{online.toLocaleString("id-ID")}</span>
      </strong>
      {t("landing.live_now")}
    </p>
  );
}
