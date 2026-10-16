// avoid-ai-design-ignore-file: L1 (centered single-action app screen, deliberate)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useLang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase, supabaseConfigured } from "../../../lib/supabase";
import { RandomMatcher } from "../../../lib/matchmaking";
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
  const [rateInfo, setRateInfo] = useState<{ rate: number; seconds: number } | null>(null);
  const matcher = useRef<RandomMatcher | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStarted = useRef(false);

  // Ambil info tarif + saldo dompet (untuk validasi sebelum mencari).
  const getBillingInfo = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user || demo) return null;
    const [{ data: cfg }, { data: wallet }] = await Promise.all([
      sb.from("billing_config").select("key, value").in("key", ["tokens_per_interval", "interval_seconds"]),
      sb.from("wallets").select("tokens").eq("user_id", user.id).maybeSingle(),
    ]);
    const map = new Map(
      ((cfg ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value])
    );
    const rate = Number.parseInt(map.get("tokens_per_interval") ?? "", 10) || 3;
    const seconds = Number.parseInt(map.get("interval_seconds") ?? "", 10) || 30;
    const balance = (wallet as { tokens?: number } | null)?.tokens ?? 0;
    return { rate, seconds, balance };
  }, [user, demo]);

  // Muat info tarif untuk ditampilkan di layar idle.
  useEffect(() => {
    void getBillingInfo().then((info) => {
      if (info) setRateInfo({ rate: info.rate, seconds: info.seconds });
    });
  }, [getBillingInfo]);

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
      // Cek saldo token sebelum mencari — match acak berbayar.
      const billing = await getBillingInfo();
      if (billing && billing.balance < billing.rate) {
        setDetail(
          t("match.insufficient")
            .replace("{required}", String(billing.rate))
        );
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

        // Caller membuat sesi penagihan — match acak memotong token caller.
        let callId = "";
        if (sb && user && peer.userId && peer.userId !== "demo" && asCaller) {
          try {
            const res = await fetch("/api/calls/random", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ peer_id: peer.userId, room_id: roomId }),
            });
            const json = await res.json().catch(() => null);
            if (json?.ok && json?.call_id) {
              callId = json.call_id as string;
            } else if (json?.error === "INSUFFICIENT_BALANCE") {
              setDetail(
                t("match.insufficient").replace(
                  "{required}",
                  String(json?.required ?? "?")
                )
              );
              setPhase("error");
              return;
            }
          } catch {
            // Gagal buat sesi billing → jangan lanjutkan call berbayar.
            setDetail(t("common.error"));
            setPhase("error");
            return;
          }
        }

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
          `/call/${roomId}?role=${asCaller ? "caller" : "callee"}&peer=${encodeURIComponent(peer.displayName)}&peerId=${encodeURIComponent(peer.userId)}${callId ? `&callId=${encodeURIComponent(callId)}` : ""}`
        );
      });
    } catch {
      setDetail(t("common.error"));
      setPhase("error");
    }
  }, [demo, profile, user, router, t, lang, getBillingInfo]);

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
    <div className="mx-auto max-w-3xl px-1">
      <div className="pt-10">
        <p className="text-sm font-semibold text-ink-soft">
          {phase === "searching"
            ? waiting > 0
              ? `${waiting} ${t("match.waiting_more")}`
              : t("match.waiting_empty")
            : t("match.sub")}
        </p>

        <h1 className="mt-3 font-display text-[clamp(2.6rem,9vw,4rem)] leading-[1.02] tracking-tight font-semibold">
          {phase === "searching" ? t("match.searching") : t("match.title")}
        </h1>

        {phase === "searching" && (
          <div className="mt-8 flex items-center gap-4" aria-hidden>
            <div className="h-2.5 w-2.5 animate-ping rounded-full bg-accent" />
            <div className="h-px flex-1 bg-gradient-to-r from-accent/60 to-transparent" />
          </div>
        )}

        {rateInfo && phase === "idle" && (
          <p className="mt-5 border-l-2 border-accent/60 pl-4 text-sm font-semibold text-ink-soft">
            {t("match.rate_note")
              .replace("{rate}", String(rateInfo.rate))
              .replace("{seconds}", String(rateInfo.seconds))}
          </p>
        )}

        {!supabaseConfigured && (
          <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-200/90">
            {t("match.demo_note")}
          </p>
        )}

        <div className="mt-9">
          {phase === "idle" && (
            <button
              onClick={() => void search()}
              className="group inline-flex items-center gap-3 rounded-2xl bg-accent px-9 py-4 text-lg font-extrabold text-[#1a1208] transition-transform hover:-translate-y-0.5 active:translate-y-0"
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
              className="rounded-2xl border border-white/15 px-8 py-3.5 text-sm font-bold text-ink-soft transition-colors hover:border-white/30 hover:text-ink"
            >
              {t("match.cancel")}
            </button>
          )}

          {phase === "error" && (
            <>
              {detail && (
                <p className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {detail}
                </p>
              )}
              <button
                onClick={() => void search()}
                className="rounded-2xl bg-accent px-8 py-3.5 font-extrabold text-[#1a1208]"
              >
                {t("common.retry")}
              </button>
            </>
          )}
        </div>

        {phase === "idle" && (
          <p className="mt-10 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
            {t("match.tip")}
          </p>
        )}
      </div>
    </div>
  );
}
