"use client";

import { useActionState, useState } from "react";
import { approveCreatorAction, rejectCreatorAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function VerifyActions({
  userId,
  eligible,
}: {
  userId: string;
  eligible: boolean;
}) {
  const [approveState, approveAction, approving] = useActionState(approveCreatorAction, initial);
  const [rejectState, rejectAction, rejecting] = useActionState(rejectCreatorAction, initial);
  const [rejecting2, setRejecting2] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={approveAction}>
        <input type="hidden" name="user_id" value={userId} />
        <button
          type="submit"
          disabled={approving || !eligible}
          title={eligible ? "Setujui kreator" : "Tidak memenuhi syarat — tidak bisa disetujui"}
          className="rounded-full bg-accent2 px-5 py-2 text-xs font-extrabold text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          {approving ? "…" : "Setujui & Aktifkan"}
        </button>
      </form>
      {!rejecting2 ? (
        <button
          type="button"
          onClick={() => setRejecting2(true)}
          className="rounded-full border border-red-500/40 px-5 py-2 text-xs font-bold text-red-300"
        >
          Tolak
        </button>
      ) : (
        <form action={rejectAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="user_id" value={userId} />
          <input
            name="reason"
            required
            minLength={5}
            placeholder="Alasan penolakan (wajib)"
            className="w-52 rounded-xl border border-white/10 bg-paper px-3 py-2 text-xs outline-none placeholder:text-ink-soft/50 focus:border-accent"
          />
          <button
            type="submit"
            disabled={rejecting}
            className="rounded-full bg-red-600 px-5 py-2 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {rejecting ? "…" : "Kirim penolakan"}
          </button>
          <button type="button" onClick={() => setRejecting2(false)} className="text-xs font-bold text-ink-soft">
            Batal
          </button>
        </form>
      )}
      {approveState.error && <p className="w-full text-xs text-red-300">{approveState.error}</p>}
      {approveState.ok && <p className="w-full text-xs text-accent2">Disetujui.</p>}
      {rejectState.error && <p className="w-full text-xs text-red-300">{rejectState.error}</p>}
      {rejectState.ok && <p className="w-full text-xs text-accent2">Ditolak.</p>}
    </div>
  );
}
