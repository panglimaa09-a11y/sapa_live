// Halaman Panggil — konsep inti SapaLive:
// User LAKI-LAKI menelepon, panggilan diteruskan ke user WANITA (kreator).
// Pilihan: dari daftar yang online (/discover) atau acak.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, Shuffle, Users } from "@phosphor-icons/react";
import { useLang, usePageTitle } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";

type Phase =
  | "idle"
  | "picking"
  | "waiting"
  | "accepted"
  | "declined"
  | "expired"
  | "insufficient"
  | "empty"
  | "not_verified"
  | "failed";

interface Creator {
  user_id: string;
  display_name: string;
  is_available: boolean;
  in_call: boolean;
  face_verified: boolean;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

export default function CallPage() {
  const { t } = useLang();
  usePageTitle(t("call.title"));
  const { user, profile } = useSession();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [peerName, setPeerName] = useState("");
  const [reqInfo, setReqInfo] = useState<{ required: number; balance: number } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFemale = profile?.role === "FEMALE";

  const stopPoll = () => {
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
  };
  useEffect(() => stopPoll, []);

  const startPolling = (callId: string) => {
    stopPoll();
    poll.current = setInterval(async () => {
      try {
        const { json } = await api(`/api/calls/${callId}`);
        const status = json?.ok
          ? (json.call as { status?: string } | undefined)?.status
          : undefined;
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

  const callRandom = async () => {
    setPhase("picking");
    try {
      const { json } = await api("/api/discover");
      const list = (json?.ok ? (json.creators as Creator[]) : []) ?? [];
      // Acak: hanya yang terverifikasi wajah (boleh video call) & online.
      const online = list.filter(
        (c) =>
          c.face_verified &&
          c.is_available &&
          !c.in_call &&
          c.user_id !== user?.id
      );
      if (online.length === 0) {
        setPhase("empty");
        return;
      }
      const pick = online[Math.floor(Math.random() * online.length)];
      setPeerName(pick.display_name);
      const { res, json: rj } = await api("/api/calls/request", {
        method: "POST",
        body: JSON.stringify({ creator_id: pick.user_id }),
      });
      if (rj?.ok && typeof rj.call_id === "string") {
        setPhase("waiting");
        startPolling(rj.call_id as string);
        return;
      }
      if (res.status === 402 || rj?.error === "INSUFFICIENT_BALANCE") {
        setReqInfo({
          required: Number(rj?.required ?? 0),
          balance: Number(rj?.balance ?? 0),
        });
        setPhase("insufficient");
        return;
      }
      if (rj?.error === "CREATOR_NOT_FACE_VERIFIED") {
        setPhase("not_verified");
        return;
      }
      setPhase("failed");
    } catch {
      setPhase("failed");
    }
  };

  const cancel = () => {
    stopPoll();
    setPhase("idle");
  };

  if (isFemale) {
    return (
      <div className="mx-auto max-w-3xl px-1">
        <div className="pt-10">
          <p className="text-sm font-semibold text-ink-soft">{t("call.female_sub")}</p>
          <h1 className="mt-3 font-display text-[clamp(2.6rem,9vw,4rem)] font-semibold leading-[1.02] tracking-tight">
            {t("call.female_title")}
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
            {t("call.female_desc")}
          </p>
          <Link
            href="/creator/dashboard"
            className="mt-9 inline-flex items-center gap-3 rounded-2xl bg-accent px-9 py-4 text-lg font-extrabold text-[#1a1208] transition-transform hover:-translate-y-0.5"
          >
            <Phone size={22} weight="fill" aria-hidden />
            {t("call.female_cta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1">
      <div className="pt-10">
        <p className="text-sm font-semibold text-ink-soft">{t("call.sub")}</p>
        <h1 className="mt-3 font-display text-[clamp(2.6rem,9vw,4rem)] font-semibold leading-[1.02] tracking-tight">
          {t("call.title")}
        </h1>

        {phase === "idle" && (
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            <Link
              href="/discover"
              className="group rounded-[28px] border border-white/10 bg-surface p-7 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Users size={28} weight="bold" aria-hidden />
              </span>
              <p className="mt-4 text-xl font-extrabold tracking-tight">
                {t("call.online_title")}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {t("call.online_desc")}
              </p>
            </Link>
            <button
              onClick={() => void callRandom()}
              className="group rounded-[28px] border border-white/10 bg-surface p-7 text-left transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Shuffle size={28} weight="bold" aria-hidden />
              </span>
              <p className="mt-4 text-xl font-extrabold tracking-tight">
                {t("call.random_title")}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                {t("call.random_desc")}
              </p>
            </button>
          </div>
        )}

        {phase === "picking" && (
          <div className="mt-9 flex items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
            <p className="font-bold text-ink-soft">{t("call.picking")}</p>
          </div>
        )}

        {phase === "waiting" && (
          <div className="mt-9 rounded-[28px] border border-white/10 bg-surface p-7">
            <div className="flex items-center gap-4">
              <div className="h-2.5 w-2.5 animate-ping rounded-full bg-accent" aria-hidden />
              <p className="font-extrabold">
                {t("call.waiting").replace("{name}", peerName)}
              </p>
            </div>
            <p className="mt-2 text-sm text-ink-soft">{t("call.waiting_sub")}</p>
            <button
              onClick={cancel}
              className="mt-5 rounded-2xl border border-white/15 px-8 py-3.5 text-sm font-bold text-ink-soft transition-colors hover:border-white/30 hover:text-ink"
            >
              {t("call.cancel")}
            </button>
          </div>
        )}

        {phase === "accepted" && (
          <p className="mt-9 font-extrabold text-accent2">{t("call.accepted")}</p>
        )}

        {(phase === "declined" ||
          phase === "expired" ||
          phase === "empty" ||
          phase === "not_verified" ||
          phase === "failed" ||
          phase === "insufficient") && (
          <div className="mt-9">
            <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {phase === "declined" && t("call.declined")}
              {phase === "expired" && t("call.expired")}
              {phase === "empty" && t("call.empty")}
              {phase === "not_verified" && t("call.not_verified")}
              {phase === "failed" && t("common.error")}
              {phase === "insufficient" &&
                t("call.insufficient")
                  .replace("{required}", String(reqInfo?.required ?? "?"))
                  .replace("{balance}", String(reqInfo?.balance ?? 0))}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => void callRandom()}
                className="rounded-2xl bg-accent px-8 py-3.5 font-extrabold text-[#1a1208]"
              >
                {t("call.retry_random")}
              </button>
              <Link
                href="/discover"
                className="rounded-2xl border border-white/15 px-8 py-3.5 text-sm font-bold text-ink-soft"
              >
                {t("call.online_title")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
