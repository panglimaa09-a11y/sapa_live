"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PaperPlaneTilt, ArrowLeft } from "@phosphor-icons/react";
import { useLang, usePageTitle } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase } from "../../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import EmptyState from "../../../components/EmptyState";

interface Thread {
  id: string;
  other_id: string;
  other_name: string;
}

interface Msg {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export default function MessagesPage() {
  const { t } = useLang();
  usePageTitle(t("nav.messages"));
  const { user } = useSession();
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<RealtimeChannel | null>(null);

  const loadThreads = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) {
      setLoading(false);
      return;
    }
    const { data } = await sb
      .from("matches")
      .select("id, user_a, user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("started_at", { ascending: false });
    const list = (data ?? []) as { id: string; user_a: string; user_b: string }[];
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
    setThreads(
      list.map((r) => {
        const oid = r.user_a === user.id ? r.user_b : r.user_a;
        return { id: r.id, other_id: oid, other_name: names.get(oid) ?? "?" };
      })
    );
    setLoading(false);
  }, [user]);

  const loadMsgs = useCallback(
    async (matchId: string) => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true })
        .limit(200);
      setMsgs((data ?? []) as Msg[]);
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    },
    []
  );

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    const m = searchParams.get("m");
    if (m) setActive(m);
  }, [searchParams]);

  useEffect(() => {
    const sb = getSupabase();
    if (chRef.current && sb) {
      void sb.removeChannel(chRef.current);
      chRef.current = null;
    }
    if (!active || !sb) {
      setMsgs([]);
      return;
    }
    void loadMsgs(active);
    const ch = sb
      .channel(`msg-${active}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${active}`,
        },
        (payload) => {
          setMsgs((prev) => [...prev, payload.new as Msg]);
          setTimeout(
            () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
            100
          );
        }
      )
      .subscribe();
    chRef.current = ch;
    return () => {
      if (sb) void sb.removeChannel(ch);
    };
  }, [active, loadMsgs]);

  const send = async () => {
    const sb = getSupabase();
    const body = draft.trim();
    if (!sb || !user || !active || !body) return;
    setDraft("");
    const thread = threads.find((x) => x.id === active);
    await sb.from("messages").insert({
      match_id: active,
      sender_id: user.id,
      body: body.slice(0, 2000),
    });
    if (thread) {
      await sb.from("notifications").insert({
        user_id: thread.other_id,
        type: "message",
        title: "Pesan baru",
        body: body.slice(0, 120),
        meta: { match_id: active },
      });
    }
  };

  const activeThread = threads.find((x) => x.id === active);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t("messages.title")}
      </h1>
      <p className="mt-2 text-ink-soft">{t("messages.sub")}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
        {/* Daftar thread */}
        <div
          className={`space-y-2 ${active ? "hidden md:block" : "block"}`}
        >
          {loading && <p className="text-sm text-ink-soft">{t("common.loading")}</p>}
          {!loading && threads.length === 0 && (
            <div className="rounded-[24px] border border-white/10 bg-surface">
              <EmptyState
                title={t("messages.empty_threads_title")}
                text={t("messages.empty_threads")}
              />
            </div>
          )}
          {threads.map((th) => (
            <button
              key={th.id}
              onClick={() => setActive(th.id)}
              className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition-colors ${
                active === th.id
                  ? "border-accent bg-accent/10"
                  : "border-white/10 bg-surface hover:border-white/25"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 font-extrabold text-accent">
                {th.other_name.charAt(0).toUpperCase()}
              </span>
              <span className="truncate font-bold">{th.other_name}</span>
            </button>
          ))}
        </div>

        {/* Percakapan */}
        <div
          className={`flex min-h-[420px] flex-col rounded-[28px] border border-white/10 bg-surface ${active ? "flex" : "hidden md:flex"}`}
        >
          {!active ? (
            <div className="m-auto w-full max-w-sm">
              <EmptyState
                title={t("messages.empty_thread_title")}
                text={t("messages.empty_thread")}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
                <button
                  onClick={() => setActive(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-white/5 md:hidden"
                  aria-label={t("common.back")}
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 font-extrabold text-accent">
                  {(activeThread?.other_name || "?").charAt(0).toUpperCase()}
                </span>
                <p className="font-bold">{activeThread?.other_name}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
                {msgs.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-[20px] px-4 py-2.5 text-[15px] ${
                          mine
                            ? "bg-accent text-white"
                            : "bg-white/5 text-ink"
                        }`}
                      >
                        {m.body}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-2 border-t border-white/10 p-4">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send();
                  }}
                  placeholder={t("messages.placeholder")}
                  maxLength={2000}
                  className="flex-1 rounded-2xl border-2 border-white/10 bg-base px-4 py-3 text-[15px] text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => void send()}
                  disabled={!draft.trim()}
                  aria-label={t("messages.send")}
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-accent text-white disabled:opacity-40"
                >
                  <PaperPlaneTilt size={20} weight="fill" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
