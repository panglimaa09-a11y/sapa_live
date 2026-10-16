// avoid-ai-design-ignore-file: L1 (centered single-action app screen, deliberate)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shuffle } from "@phosphor-icons/react";
import Radar from "../../../components/Radar";
import { useLang } from "../../../lib/i18n";
import { getSupabase, supabaseConfigured } from "../../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PresenceMeta } from "../../../lib/matchmaking";

/** Jelajahi: data nyata — jumlah orang dalam antrean live via presence. */
export default function ExplorePage() {
  const { t } = useLang();
  const [count, setCount] = useState<number | null>(null);

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
      setCount(n);
    };
    ch = sb.channel("sapalive-lobby", {
      config: { presence: { key: `explore-${Math.random()}` } },
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

  return (
    <div className="relative mx-auto max-w-3xl">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-80 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-accent2/10 blur-3xl" aria-hidden />

      <div className="relative pt-8 text-center">
        <Radar count={count} label={t("explore.live")} searching={false} />

        <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t("explore.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-[52ch] text-ink-soft">{t("explore.sub")}</p>

        {!supabaseConfigured ? (
          <p className="mx-auto mt-5 max-w-[60ch] rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-200/90">
            {t("match.demo_note")}
          </p>
        ) : count === 0 ? (
          <p className="mx-auto mt-5 max-w-[52ch] font-bold text-ink-soft">{t("explore.empty")}</p>
        ) : null}

        <Link
          href="/match"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-10 py-4 text-lg font-extrabold text-white shadow-[0_8px_40px_-8px] shadow-accent/60 transition-transform hover:-translate-y-0.5"
        >
          <Shuffle size={22} weight="fill" aria-hidden />
          {t("explore.cta")}
        </Link>
      </div>
    </div>
  );
}
