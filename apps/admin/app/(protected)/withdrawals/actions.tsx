"use client";

import { useActionState, useState } from "react";
import { withdrawalAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function WithdrawalActions({ id, status }: { id: string; status: string }) {
  const [state, formAction, pending] = useActionState(withdrawalAction, initial);
  const [mode, setMode] = useState<"paid" | "reject" | null>(null);

  if (status === "REQUESTED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <form action={formAction} className="inline">
          <input type="hidden" name="withdrawal_id" value={id} />
          <input type="hidden" name="action" value="approve" />
          <button type="submit" disabled={pending} className="rounded-full bg-accent px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60">
            {pending ? "…" : "Setujui → Proses"}
          </button>
        </form>
        {!mode ? (
          <button type="button" onClick={() => setMode("reject")} className="rounded-full border border-red-500/40 px-4 py-2 text-xs font-bold text-red-300">
            Tolak
          </button>
        ) : (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="withdrawal_id" value={id} />
            <input type="hidden" name="action" value="reject" />
            <input name="failure_reason" required minLength={5} placeholder="Alasan (wajib)" className="w-40 rounded-xl border border-white/10 bg-paper px-3 py-2 text-xs outline-none focus:border-accent" />
            <button type="submit" disabled={pending} className="rounded-full bg-red-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60">Kirim</button>
            <button type="button" onClick={() => setMode(null)} className="text-xs text-ink-soft">Batal</button>
          </form>
        )}
        {state.error && <p className="w-full text-xs text-red-300">{state.error}</p>}
        {state.ok && <p className="w-full text-xs text-accent2">Berhasil.</p>}
      </div>
    );
  }

  if (status === "PROCESSING") {
    return (
      <div>
        {!mode ? (
          <button type="button" onClick={() => setMode("paid")} className="rounded-full bg-accent2 px-4 py-2 text-xs font-extrabold text-ink">
            Tandai PAID
          </button>
        ) : (
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="withdrawal_id" value={id} />
            <input type="hidden" name="action" value="mark_paid" />
            <input name="payment_reference" required minLength={3} placeholder="Ref. transfer nyata (wajib)" className="w-52 rounded-xl border border-white/10 bg-paper px-3 py-2 text-xs outline-none focus:border-accent" />
            <button type="submit" disabled={pending} className="rounded-full bg-accent2 px-4 py-2 text-xs font-extrabold text-ink disabled:opacity-60">
              {pending ? "…" : "Konfirmasi PAID"}
            </button>
            <button type="button" onClick={() => setMode(null)} className="text-xs text-ink-soft">Batal</button>
          </form>
        )}
        {state.error && <p className="mt-1 text-xs text-red-300">{state.error}</p>}
        {state.ok && <p className="mt-1 text-xs text-accent2">Berhasil.</p>}
      </div>
    );
  }

  return null;
}
