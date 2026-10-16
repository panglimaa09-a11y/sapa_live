// avoid-ai-design-ignore-file: L1 (centered single-action app screen, deliberate)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useLang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase, supabaseConfigured } from "../../../lib/supabase";
import { RandomMatcher } from "../../../lib/matchmaking";
import Radar from "../../../components/Radar";
import {
  SupabaseLobbyTransport,
  LoopbackLobbyTransport,
} from "../../../lib/lobby-transports";

type Phase = "idle" | "searching" | "error";

export default function MatchPage() {
  const { t, lang } = useLang();
  const { user, profile, demo } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const [detail, setDetail] = useState("");
  const [waiting, setWaiting] = useState(0);
  const matcher = useRef<RandomMatcher | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStarted = useRef(false);

  const search = useCallback(async () => {
    if (poll.current) clearInterval(poll.current);
    setDetail("");
    if (!demo) {
      if (profile?.is_banned) {
        setDetail(t("common.error"));
        setPhase("error");
        return;
      }
      if (!profile?.age_verified) {
        setDetail(t("match.age_required"));
        setPhase("error");
        return;
      }
      if (profile && !profile.allow_random) {
        setDetail(t("match.age_required"));
        setPhase("error");
        return;
      }
    }
    setPhase("searching");
    setWaiting(0);

    const sb = getSupabase();
    let blockedIds = new Set<string>();
    if (sb && user) {
      const [b1, b2] = await Promise.all([
        sb.from("blocks").select("blocked_id").eq("blocker_id", user.id),
        sb.from("blocks").select("blocker_id").eq("blocked_id", user.id),
      ]);
      blockedIds = new Set([
        ...((b1.data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id),
        ...((b2.data ?? []) as { blocker_id: string }[]).map((r) => r.blocker_id),
      ]);
    }

    const identity = {
      userId: user?.id ?? "demo",
      displayName:
        profile?.display_name || user?.email?.split("@")[0] || "Demo",
    };
    const transport =
      supabaseConfigured && sb
        ? new SupabaseLobbyTransport(identity)
        : new LoopbackLobbyTransport(identity);
    const m = new RandomMatcher(transport, { blockedIds });
    matcher.current = m;
    poll.current = setInterval(() => setWaiting(m.waitingCount()), 1500);

    try {
      await m.startSearch(async (roomId, asCaller, peer) => {
        await m.stop();
        matcher.current = null;
        if (poll.current) clearInterval(poll.current);
        if (sb && user && peer.userId && peer.userId !== "demo") {
          if (asCaller) {
            await sb.from("matches").insert({
              room_id: roomId,
              user_a: user.id,
              user_b: peer.userId,
            });
          }
          await sb.from("notifications").insert({
            user_id: user.id,
            type: "match",
            title:
              lang === "id"
                ? "Pasangan ditemukan!"
                : "Partner found!",
            body: peer.displayName,
            meta: { room_id: roomId },
          });
        }
        router.push(
          `/call/${roomId}?role=${asCaller ? "caller" : "callee"}&peer=${encodeURIComponent(peer.displayName)}&peerId=${encodeURIComponent(peer.userId)}`
        );
      });
    } catch {
      setDetail(t("common.error"));
      setPhase("error");
    }
  }, [demo, profile, user, router, t, lang]);

  const cancelSearch = useCallback(async () => {
    if (poll.current) clearInterval(poll.current);
    await matcher.current?.stop();
    matcher.current = null;
    setPhase("idle");
  }, []);

  useEffect(() => {
    if (searchParams.get("auto") === "1" && !autoStarted.current) {
      autoStarted.current = true;
      void search();
    }
  }, [search, searchParams]);

  useEffect(() => {
    return () => {
      if (poll.current) clearInterval(poll.current);
      void matcher.current?.stop();
    };
  }, []);

  return (
    <div className="relative mx-auto max-w-3xl">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 h-80 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" aria-hidden />

      <div className="relative pt-8 text-center">
        <Radar
          count={phase === "searching" ? waiting : null}
          label={t("match.radar_label")}
          searching={phase === "searching"}
        />

        <h1 className="mt-8 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {phase === "searching" ? t("match.searching") : t("match.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-[52ch] text-ink-soft">
          {phase === "searching"
            ? waiting > 0
              ? `${waiting} ${t("match.waiting_more")}`
              : t("match.waiting_empty")
            : t("match.sub")}
        </p>

        {!supabaseConfigured && (
          <p className="mx-auto mt-5 max-w-[60ch] rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-center text-sm text-amber-200/90">
            {t("match.demo_note")}
          </p>
        )}

        <div className="mt-8">
          {phase === "idle" && (
            <button
              onClick={() => void search()}
              className="group inline-flex items-center gap-3 rounded-full bg-accent px-10 py-4 text-lg font-extrabold text-white shadow-[0_8px_40px_-8px] shadow-accent/60 transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <MagnifyingGlass
                size={24}
                weight="bold"
                aria-hidden
                className="transition-transform group-hover:rotate-12"
              />
              {t("match.start")}
            </button>
          )}

          {phase === "searching" && (
            <button
              onClick={() => void cancelSearch()}
              className="rounded-full border-2 border-white/15 px-8 py-3 text-sm font-bold text-ink-soft transition-colors hover:border-white/30 hover:text-ink"
            >
              {t("match.cancel")}
            </button>
          )}

          {phase === "error" && (
            <>
              {detail && (
                <p className="mx-auto mb-4 max-w-[52ch] rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {detail}
                </p>
              )}
              <button
                onClick={() => void search()}
                className="rounded-full bg-accent px-8 py-3.5 font-extrabold text-white"
              >
                {t("common.retry")}
              </button>
            </>
          )}
        </div>

        {phase === "idle" && (
          <div className="mx-auto mt-10 grid max-w-xl grid-cols-3 gap-3 text-center">
            {[
              { n: "1", label: t("match.tip_1") },
              { n: "2", label: t("match.tip_2") },
              { n: "3", label: t("match.tip_3") },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/10 bg-surface/60 px-3 py-4">
                <p className="text-2xl font-extrabold text-accent">{s.n}</p>
                <p className="mt-1 text-xs leading-snug text-ink-soft">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
