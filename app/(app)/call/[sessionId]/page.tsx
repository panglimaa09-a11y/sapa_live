// avoid-ai-design-ignore-file: K3 (badges over live video tile)
"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FastForward,
  Flag,
  PhoneDisconnect,
  Microphone,
  MicrophoneSlash,
  VideoCamera,
  VideoCameraSlash,
} from "@phosphor-icons/react";
import { CallManager, type CallState } from "../../../../lib/webrtc";
import { useLang } from "../../../../lib/i18n";
import { useSession } from "../../../../lib/session";
import { getSupabase } from "../../../../lib/supabase";
import ReportDialog from "../../../../components/ReportDialog";

type Phase = "preparing" | "connecting" | "incall" | "left" | "error" | "declined";

interface Bill {
  billable_seconds: number;
  intervals: number;
  tokens_charged: number;
}

export default function CallPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLang();
  const { user } = useSession();
  const role = searchParams.get("role") === "caller";
  const callId = searchParams.get("callId") || "";
  const isPaid = callId.length > 0;
  const [peerName, setPeerName] = useState(searchParams.get("peer") || t("match.stranger"));
  const peerId = searchParams.get("peerId") || "";

  const [phase, setPhase] = useState<Phase>("preparing");
  const [detail, setDetail] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [callRate, setCallRate] = useState(3);
  const [bill, setBill] = useState<Bill | null>(null);

  const mgr = useRef<CallManager | null>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<Phase>("preparing");
  const mounted = useRef(true);
  const endRecorded = useRef(false);
  const connectedPosted = useRef(false);
  const billPosted = useRef(false);
  phaseRef.current = phase;

  // Token terpakai: floor(detik/30) * tarif — hanya berjalan saat connected.
  const tokensUsed = isPaid ? Math.floor(seconds / 30) * callRate : 0;

  const postCall = async (action: "connected" | "end", body?: Record<string, unknown>) => {
    if (!isPaid) return null;
    try {
      const res = await fetch(`/api/calls/${callId}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await res.json().catch(() => null);
    } catch {
      return null;
    }
  };

  const recordEnd = async () => {
    if (endRecorded.current) return;
    endRecorded.current = true;
    if (isPaid) {
      if (!billPosted.current) {
        billPosted.current = true;
        const json = await postCall("end", { end_reason: "user_ended" });
        if (json && typeof json.billable_seconds === "number") {
          setBill({
            billable_seconds: json.billable_seconds,
            intervals: json.intervals ?? 0,
            tokens_charged: json.tokens_charged ?? 0,
          });
        }
      }
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    try {
      await sb
        .from("matches")
        .update({ ended_at: new Date().toISOString(), duration_sec: seconds })
        .eq("room_id", sessionId);
    } catch {
      /* abaikan */
    }
  };

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    const boot = async () => {
      // Mode berbayar: ambil info call dulu (tarif, status, nama lawan bicara).
      if (isPaid) {
        try {
          const res = await fetch(`/api/calls/${callId}`, { cache: "no-store" });
          const json = await res.json().catch(() => null);
          const call = json?.ok ? json.call : null;
          if (!mounted.current || cancelled) return;
          if (!call) {
            setPhase("error");
            return;
          }
          const st = String(call.status ?? "").toUpperCase();
          if (st === "DECLINED") {
            setPhase("declined");
            return;
          }
          setCallRate(Number(call.rate_tokens_per_interval ?? 3) || 3);
          const otherId =
            call.male_user_id === user?.id ? call.female_creator_id : call.male_user_id;
          if (otherId) {
            const sb = getSupabase();
            const { data } = (await sb
              ?.from("public_profiles")
              .select("display_name")
              .eq("id", otherId)
              .maybeSingle()) ?? { data: null };
            if (mounted.current && !cancelled && data)
              setPeerName((data as { display_name: string }).display_name);
          }
        } catch {
          if (mounted.current && !cancelled) setPhase("error");
          return;
        }
      } else {
        // Ambil match id untuk keperluan lapor/pesan (mode acak).
        void getSupabase()
          ?.from("matches")
          .select("id")
          .eq("room_id", sessionId)
          .maybeSingle()
          .then(({ data }) => {
            if (mounted.current && data) setMatchId((data as { id: string }).id);
          });
      }
      if (!mounted.current || cancelled) return;

      mgr.current = new CallManager({
        onState: (s: CallState, d) => {
          if (!mounted.current) return;
          setDetail(d ?? "");
          if (s === "connected") {
            setPhase("incall");
            setSeconds(0);
            tick.current = setInterval(() => setSeconds((x) => x + 1), 1000);
            if (isPaid && !connectedPosted.current) {
              connectedPosted.current = true;
              void postCall("connected");
            }
          } else if (s === "ended") {
            if (tick.current) clearInterval(tick.current);
            if (phaseRef.current === "incall" || phaseRef.current === "connecting") {
              void recordEnd();
              setPhase("left");
              if (!isPaid) {
                retryTimer.current = setTimeout(() => {
                  if (mounted.current) router.push("/match?auto=1");
                }, 2200);
              }
            }
          } else if (s === "error") {
            setPhase("error");
          }
        },
        onRemoteStream: (st) => {
          if (remoteRef.current) remoteRef.current.srcObject = st;
        },
      });

      try {
        const stream = await mgr.current!.startLocalMedia();
        if (!mounted.current || cancelled) return;
        if (localRef.current) {
          localRef.current.srcObject = stream;
          localRef.current.muted = true;
        }
      } catch {
        if (mounted.current && !cancelled) setPhase("error");
        return;
      }
      if (!mounted.current || cancelled) return;
      setPhase("connecting");
      await mgr.current!.joinMatchedRoom(sessionId, role);
    };

    void boot();

    return () => {
      cancelled = true;
      mounted.current = false;
      if (tick.current) clearInterval(tick.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      void recordEnd();
      void mgr.current?.hangup();
      mgr.current?.destroy();
      mgr.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const toggleMic = () => {
    mgr.current?.localStream
      ?.getAudioTracks()
      .forEach((tr) => (tr.enabled = !micOn));
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    mgr.current?.localStream
      ?.getVideoTracks()
      .forEach((tr) => (tr.enabled = !camOn));
    setCamOn((v) => !v);
  };

  const next = async () => {
    if (tick.current) clearInterval(tick.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    await recordEnd();
    await mgr.current?.hangup();
    router.push(isPaid ? "/discover" : "/match?auto=1");
  };

  const endCall = async () => {
    if (tick.current) clearInterval(tick.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    await recordEnd();
    await mgr.current?.hangup();
    if (isPaid) {
      setPhase("left");
    } else {
      router.push("/dashboard");
    }
  };

  const stopAuto = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    router.push("/dashboard");
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const ctl =
    "flex h-[52px] w-[52px] items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95";

  return (
    <div className="mx-auto max-w-3xl">
      {(phase === "preparing" || phase === "connecting") && (
        <div className="py-16 text-center">
          <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
          <p className="text-lg font-extrabold">{t("match.found")}</p>
          <p className="mt-2 text-sm text-ink-soft">{t("match.connecting")}</p>
        </div>
      )}

      {phase === "error" && (
        <div className="py-16 text-center">
          <p className="mx-auto max-w-[52ch] rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {detail || t("common.error")}
          </p>
          <button
            onClick={() => router.push("/match")}
            className="mt-6 rounded-full bg-accent px-8 py-3.5 font-extrabold text-[#1a1208]"
          >
            {t("common.back")}
          </button>
        </div>
      )}

      {phase === "declined" && (
        <div className="py-16 text-center">
          <p className="text-lg font-extrabold">{t("call.declined_msg")}</p>
          <button
            onClick={() => router.push("/discover")}
            className="mt-6 rounded-full bg-accent px-8 py-3.5 font-extrabold text-[#1a1208]"
          >
            {t("common.back")}
          </button>
        </div>
      )}

      {phase === "left" && (
        <div className="py-16 text-center">
          <p className="text-lg font-extrabold">
            {isPaid ? t("call.call_ended") : t("match.partner_left")}
          </p>
          {isPaid && bill && (
            <div className="mx-auto mt-6 max-w-sm rounded-[24px] border border-white/10 bg-surface p-6 text-left">
              <p className="text-center font-extrabold">{t("call.bill_title")}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-soft">{t("call.bill_duration")}</span>
                  <span className="font-extrabold tabular-nums">
                    {bill.billable_seconds} {t("call.sec")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">{t("call.bill_intervals")}</span>
                  <span className="font-extrabold tabular-nums">{bill.intervals}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-ink-soft">{t("call.bill_tokens")}</span>
                  <span className="font-extrabold text-accent2 tabular-nums">
                    {bill.tokens_charged} token
                  </span>
                </div>
              </div>
            </div>
          )}
          {!isPaid && <p className="mt-2 text-sm text-ink-soft">{t("match.searching_new")}</p>}
          <button
            onClick={isPaid ? () => router.push("/dashboard") : stopAuto}
            className="mt-6 rounded-full border-2 border-white/15 px-6 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:border-white/30 hover:text-ink"
          >
            {isPaid ? t("call.back_dashboard") : t("match.stop")}
          </button>
        </div>
      )}

      {phase === "incall" && (
        <div>
          {isPaid && (
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-accent/15 px-4 py-1.5 text-xs font-extrabold text-accent tabular-nums">
                {t("call.rate_banner").replace("{n}", String(callRate))}
              </span>
              <span className="rounded-full bg-accent2/15 px-4 py-1.5 text-xs font-extrabold text-accent2 tabular-nums">
                {t("call.tokens_used")}: {tokensUsed}
              </span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black">
              <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full -scale-x-100 object-cover"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                {t("match.you")}
              </span>
            </div>
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black">
              <video
                ref={remoteRef}
                autoPlay
                playsInline
                className="aspect-[4/3] w-full object-cover"
              />
              <span className="absolute bottom-3 left-3 max-w-[60%] truncate rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                {peerName}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 font-mono text-xs font-bold text-white backdrop-blur">
                {fmt(seconds)}
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => void next()}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 font-extrabold text-[#1a1208] transition-transform hover:scale-[1.03] active:scale-95"
            >
              <FastForward size={20} weight="fill" />
              {t("match.next")}
            </button>
            <button
              onClick={toggleMic}
              aria-label="Microphone"
              className={`${ctl} border-2 ${micOn ? "border-white/15 text-ink" : "border-red-500/50 bg-red-500/15 text-red-300"}`}
            >
              {micOn ? <Microphone size={22} /> : <MicrophoneSlash size={22} />}
            </button>
            <button
              onClick={toggleCam}
              aria-label="Camera"
              className={`${ctl} border-2 ${camOn ? "border-white/15 text-ink" : "border-red-500/50 bg-red-500/15 text-red-300"}`}
            >
              {camOn ? <VideoCamera size={22} /> : <VideoCameraSlash size={22} />}
            </button>
            <button
              onClick={() => void endCall()}
              aria-label={t("match.end")}
              className={`${ctl} bg-red-600 text-white`}
            >
              <PhoneDisconnect size={22} weight="fill" />
            </button>
            <button
              onClick={() => setShowReport(true)}
              aria-label={t("match.report")}
              className={`${ctl} border-2 border-white/15 text-ink-soft hover:text-ink`}
            >
              <Flag size={20} weight="bold" />
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-ink-soft">{t("match.tip")}</p>
        </div>
      )}

      {showReport && (
        <ReportDialog
          reportedUserId={peerId}
          matchId={matchId}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
