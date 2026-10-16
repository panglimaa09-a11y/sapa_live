"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";
import { useSession } from "../lib/session";
import { getSupabase } from "../lib/supabase";

export default function ReportDialog({
  reportedUserId,
  matchId,
  onClose,
}: {
  reportedUserId?: string;
  matchId?: string | null;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { user } = useSession();
  const reasons = [
    t("report.r1"),
    t("report.r2"),
    t("report.r3"),
    t("report.r4"),
    t("report.r5"),
  ];
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const sb = getSupabase();
    setBusy(true);
    try {
      if (sb && user) {
        await sb.from("reports").insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId || null,
          match_id: matchId || null,
          reason,
          note: note.slice(0, 500) || null,
        });
      }
    } catch {
      /* tetap tampilkan konfirmasi */
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("report.title")}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[28px] border border-white/10 bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">
            {t("report.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-white/5 hover:text-ink"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        {sent ? (
          <p className="mt-4 rounded-2xl border border-accent2/30 bg-accent2/10 px-4 py-3 text-sm font-semibold text-accent2">
            {t("report.done")}
          </p>
        ) : (
          <>
            <label className="mt-4 block text-sm font-bold">
              {t("report.reason")}
            </label>
            <div className="mt-2 space-y-2">
              {reasons.map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    reason === r
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-white/10 text-ink-soft hover:border-white/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[#6c7cff]"
                  />
                  {r}
                </label>
              ))}
            </div>
            <label className="mt-4 block text-sm font-bold">
              {t("report.note")}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-2 w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <button
              onClick={() => void submit()}
              disabled={busy}
              className="mt-4 w-full rounded-2xl bg-accent px-6 py-3.5 font-extrabold text-[#1a1208] disabled:opacity-60"
            >
              {busy ? t("common.loading") : t("report.submit")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
