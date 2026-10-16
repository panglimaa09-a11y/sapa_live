// avoid-ai-design-ignore-file: L1 (centered profile app screen, deliberate)
"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChatCircleText, Flag, Prohibit, ShieldCheck, VideoCamera } from "@phosphor-icons/react";
import { useLang } from "../../../../lib/i18n";
import { useSession } from "../../../../lib/session";
import { getSupabase } from "../../../../lib/supabase";
import { getWallet } from "../../../../lib/wallet";
import ReportDialog from "../../../../components/ReportDialog";

interface Creator {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  preferred_language: string | null;
  rate_tokens_per_interval: number;
  is_available: boolean;
  face_verified: boolean;
}

type ReqPhase = "idle" | "confirm" | "waiting" | "accepted" | "declined" | "expired" | "insufficient" | "failed";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* abaikan */
  }
  return { res, json: json as Record<string, unknown> | null };
}

export default function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl py-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
        </div>
      }
    >
      <CreatorDetailInner params={params} />
    </Suspense>
  );
}

function CreatorDetailInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useLang();
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoCalled = useRef(false);

  const [creator, setCreator] = useState<Creator | null | undefined>(undefined);
  const [balance, setBalance] = useState<number | null>(null);
  const [phase, setPhase] = useState<ReqPhase>("idle");
  const [reqInfo, setReqInfo] = useState<{ required: number; balance: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };
  useEffect(() => stopPoll, []);

  const load = useCallback(async () => {
    try {
      const { json } = await api("/api/discover");
      const list = (json?.ok ? (json.creators as Creator[]) : []) ?? [];
      setCreator(list.find((c) => c.user_id === id) ?? null);
    } catch {
      setCreator(null);
    }
    if (user) {
      const w = await getWallet(user.id);
      setBalance(w?.tokens ?? 0);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Dari tombol telepon di kartu kreator: langsung buka konfirmasi panggilan.
  // Hanya jika sudah verifikasi wajah (aturan Tuan).
  useEffect(() => {
    if (
      !autoCalled.current &&
      searchParams.get("call") === "1" &&
      creator &&
      creator.is_available &&
      creator.face_verified &&
      !blocked
    ) {
      autoCalled.current = true;
      setPhase("confirm");
    }
  }, [searchParams, creator, blocked]);

  const startPolling = (callId: string) => {
    stopPoll();
    poll.current = setInterval(async () => {
      try {
        const { json } = await api(`/api/calls/${callId}`);
        const call = json?.ok ? (json.call as { status?: string } | undefined) : undefined;
        const status = call?.status;
        if (status === "ACCEPTED") {
          stopPoll();
          setPhase("accepted");
          setTimeout(() => router.push(`/call/${callId}?callId=${callId}&role=caller`), 900);
        } else if (status === "DECLINED") {
          stopPoll();
          setPhase("declined");
        } else if (status === "EXPIRED" || status === "CANCELLED") {
          stopPoll();
          setPhase("expired");
        }
      } catch {
        /* coba lagi di interval berikutnya */
      }
    }, 3000);
  };

  const requestCall = async () => {
    setPhase("waiting");
    setReqInfo(null);
    try {
      const { res, json } = await api("/api/calls/request", {
        method: "POST",
        body: JSON.stringify({ creator_id: id }),
      });
      if (json?.ok && typeof json.call_id === "string") {
        startPolling(json.call_id as string);
        return;
      }
      if (res.status === 402 || json?.error === "INSUFFICIENT_BALANCE") {
        setReqInfo({
          required: Number(json?.required ?? 0),
          balance: Number(json?.balance ?? balance ?? 0),
        });
        setPhase("insufficient");
        return;
      }
      setPhase("failed");
    } catch {
      setPhase("failed");
    }
  };

  const cancelWaiting = () => {
    stopPoll();
    setPhase("idle");
  };

  const startChat = async () => {
    try {
      const { json } = await api("/api/chats/start", {
        method: "POST",
        body: JSON.stringify({ user_id: id }),
      });
      if (json?.ok && typeof json.match_id === "string") {
        router.push(`/messages?m=${json.match_id as string}`);
      }
    } catch {
      /* abaikan */
    }
  };

  const blockCreator = async () => {
    if (!user) return;
    if (!window.confirm(t("creator.block_confirm"))) return;
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("blocks").insert({ blocker_id: user.id, blocked_id: id });
    setBlocked(true);
  };

  if (creator === undefined) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
      </div>
    );
  }

  if (creator === null) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-lg font-extrabold">{t("creator.not_found")}</p>
        <Link href="/discover" className="mt-6 inline-block rounded-full bg-accent px-8 py-3.5 font-extrabold text-white">
          {t("creator.back")}
        </Link>
      </div>
    );
  }

  const langLabel =
    creator.preferred_language === "en"
      ? "English"
      : creator.preferred_language === "id"
        ? "Indonesia"
        : (creator.preferred_language ?? "—");

  return (
    <div className="relative mx-auto max-w-2xl">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-72 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" aria-hidden />

      <div className="relative pt-6">
        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={16} aria-hidden />
          {t("creator.back")}
        </Link>

        <div className="mt-4 overflow-hidden rounded-[32px] border border-white/10 bg-surface">
          <div className="flex flex-col items-center px-6 pb-6 pt-10 text-center">
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.display_name}
                className="h-28 w-28 rounded-full object-cover ring-4 ring-accent/30"
              />
            ) : (
              <span className="flex h-28 w-28 items-center justify-center rounded-full bg-accent/20 text-5xl font-extrabold text-accent">
                {creator.display_name.charAt(0).toUpperCase()}
              </span>
            )}
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
              {creator.display_name}
            </h1>
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                creator.is_available ? "bg-accent2/15 text-accent2" : "bg-white/5 text-ink-soft"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${creator.is_available ? "bg-accent2" : "bg-ink-soft"}`} aria-hidden />
              {creator.is_available ? t("discover.available") : t("discover.unavailable")}
            </span>
            {creator.bio && (
              <p className="mt-4 max-w-[46ch] leading-relaxed text-ink-soft">{creator.bio}</p>
            )}
          </div>

          <dl className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/10 text-center">
            <div className="px-3 py-4">
              <dt className="text-xs font-bold text-ink-soft">{t("creator.rate")}</dt>
              <dd className="mt-1 font-extrabold text-accent2 tabular-nums">
                {creator.rate_tokens_per_interval} <span className="text-xs font-bold">{t("discover.rate_unit")}</span>
              </dd>
            </div>
            <div className="px-3 py-4">
              <dt className="text-xs font-bold text-ink-soft">{t("creator.language")}</dt>
              <dd className="mt-1 font-extrabold">{langLabel}</dd>
            </div>
            <div className="px-3 py-4">
              <dt className="text-xs font-bold text-ink-soft">{t("creator.status")}</dt>
              <dd className="mt-1 font-extrabold">
                {creator.is_available ? t("discover.available") : t("discover.unavailable")}
              </dd>
            </div>
          </dl>

          <div className="space-y-3 px-6 pb-6">
            {phase === "idle" && creator.face_verified && (
              <button
                onClick={() => setPhase("confirm")}
                disabled={!creator.is_available || blocked}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-extrabold text-white transition-transform hover:scale-[1.01] disabled:opacity-40"
              >
                <VideoCamera size={22} weight="fill" aria-hidden />
                {t("creator.start_call")}
              </button>
            )}
            {phase === "idle" && !creator.face_verified && (
              <>
                <p className="rounded-2xl border border-white/10 bg-base px-4 py-3 text-sm text-ink-soft">
                  {t("creator.chat_only_note")}
                </p>
                <button
                  onClick={() => void startChat()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-extrabold text-white transition-transform hover:scale-[1.01]"
                >
                  <ChatCircleText size={22} weight="fill" aria-hidden />
                  {t("discover.chat")}
                </button>
              </>
            )}
            {phase === "confirm" && (
              <div className="rounded-2xl border border-white/10 bg-base p-5" role="dialog" aria-label={t("creator.confirm_title")}>
                <p className="font-extrabold">{t("creator.confirm_title")}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">{t("creator.confirm_rate")}</span>
                    <span className="font-extrabold text-accent2 tabular-nums">
                      {creator.rate_tokens_per_interval} {t("discover.rate_unit")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">{t("creator.confirm_balance")}</span>
                    <span className="font-extrabold tabular-nums">
                      {balance === null ? "…" : balance} token
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-soft">{t("creator.confirm_info")}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPhase("idle")}
                    className="rounded-2xl border-2 border-white/15 px-4 py-3 text-sm font-bold text-ink-soft hover:text-ink"
                  >
                    {t("creator.confirm_cancel")}
                  </button>
                  <button
                    onClick={() => void requestCall()}
                    className="rounded-2xl bg-accent px-4 py-3 text-sm font-extrabold text-white"
                  >
                    {t("creator.confirm_yes")}
                  </button>
                </div>
              </div>
            )}
            {(phase === "waiting" || phase === "accepted") && (
              <div className="rounded-2xl border border-white/10 bg-base p-5 text-center">
                {phase === "waiting" ? (
                  <>
                    <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
                    <p className="font-extrabold">{t("creator.waiting")}</p>
                    <p className="mt-1 text-sm text-ink-soft">{t("creator.waiting_sub")}</p>
                    <button
                      onClick={cancelWaiting}
                      className="mt-4 rounded-full border-2 border-white/15 px-6 py-2.5 text-sm font-bold text-ink-soft hover:text-ink"
                    >
                      {t("creator.cancel_req")}
                    </button>
                  </>
                ) : (
                  <p className="font-extrabold text-accent2">{t("creator.accepted")}</p>
                )}
              </div>
            )}
            {phase === "declined" && (
              <div className="rounded-2xl border border-white/10 bg-base p-5 text-center">
                <p className="font-extrabold">{t("creator.declined")}</p>
                <button onClick={() => setPhase("idle")} className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-extrabold text-white">
                  {t("common.back")}
                </button>
              </div>
            )}
            {phase === "expired" && (
              <div className="rounded-2xl border border-white/10 bg-base p-5 text-center">
                <p className="font-extrabold">{t("creator.expired")}</p>
                <button onClick={() => setPhase("idle")} className="mt-4 rounded-full bg-accent px-6 py-2.5 text-sm font-extrabold text-white">
                  {t("common.back")}
                </button>
              </div>
            )}
            {phase === "insufficient" && (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 text-center">
                <p className="font-extrabold text-amber-200">{t("creator.insufficient_title")}</p>
                <p className="mt-2 text-sm text-ink-soft">
                  {t("creator.insufficient_text")
                    .replace("{required}", String(reqInfo?.required ?? 0))
                    .replace("{balance}", String(reqInfo?.balance ?? 0))}
                </p>
                <Link href="/wallet" className="mt-4 inline-block rounded-full bg-accent px-8 py-3 text-sm font-extrabold text-white">
                  {t("creator.topup_now")}
                </Link>
              </div>
            )}
            {phase === "failed" && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
                <p className="text-sm font-bold text-red-300">{t("creator.request_failed")}</p>
                <button onClick={() => setPhase("idle")} className="mt-3 rounded-full bg-accent px-6 py-2.5 text-sm font-extrabold text-white">
                  {t("common.retry")}
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowReport(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/10 px-4 py-3 text-sm font-bold text-ink-soft hover:text-ink"
              >
                <Flag size={18} aria-hidden />
                {t("creator.report")}
              </button>
              <button
                onClick={() => void blockCreator()}
                disabled={blocked}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-white/10 px-4 py-3 text-sm font-bold text-ink-soft hover:text-ink disabled:opacity-50"
              >
                <Prohibit size={18} aria-hidden />
                {blocked ? t("creator.blocked") : t("creator.block")}
              </button>
            </div>

            <div className="flex gap-3 rounded-2xl bg-base p-4">
              <ShieldCheck size={22} aria-hidden className="shrink-0 text-accent2" />
              <div>
                <p className="text-sm font-extrabold">{t("creator.safety_title")}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t("creator.safety_text")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showReport && (
        <ReportDialog
          reportedUserId={id}
          matchId={null}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
