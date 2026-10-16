"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PresenceMeta } from "../lib/matchmaking";

/** Jumlah orang dalam antrean matchmaking — DATA NYATA via presence. */
export default function LiveCounter() {
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

  if (online === null) return <span className="tabular-nums">—</span>;
  return <span className="tabular-nums">{online.toLocaleString("id-ID")}</span>;
}
