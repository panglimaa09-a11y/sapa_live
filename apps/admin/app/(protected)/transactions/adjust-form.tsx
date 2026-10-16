"use client";

import { useActionState, useState } from "react";
import { adjustWalletAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

/** Koreksi token via transaksi kompensasi (bukan edit ledger). */
export function AdjustForm() {
  const [state, formAction, pending] = useActionState(adjustWalletAction, initial);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-amber-400/40 px-5 py-2.5 text-sm font-bold text-amber-300"
        >
          Koreksi saldo
        </button>
      ) : (
        <form
          action={formAction}
          className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4"
        >
          <p className="mb-3 text-xs font-bold text-amber-300">
            Koreksi kompensasi — tercatat sebagai ADMIN_ADJUST + audit log. Tidak mengubah riwayat.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              name="user_id"
              required
              placeholder="user_id (UUID)"
              className="min-w-52 flex-1 rounded-xl border border-white/10 bg-paper px-3 py-2 font-mono text-xs outline-none placeholder:text-ink-soft/50 focus:border-accent"
            />
            <input
              name="delta"
              required
              type="number"
              placeholder="Delta, cth: 50 / -20"
              className="w-36 rounded-xl border border-white/10 bg-paper px-3 py-2 text-xs outline-none placeholder:text-ink-soft/50 focus:border-accent"
            />
            <input
              name="reason"
              required
              minLength={5}
              placeholder="Alasan (wajib)"
              className="min-w-52 flex-1 rounded-xl border border-white/10 bg-paper px-3 py-2 text-xs outline-none placeholder:text-ink-soft/50 focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-amber-400 px-5 py-2 text-xs font-extrabold text-ink disabled:opacity-60"
            >
              {pending ? "…" : "Terapkan"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-ink-soft">
              Batal
            </button>
          </div>
          {state.error && <p className="mt-2 text-xs text-red-300">{state.error}</p>}
          {state.ok && <p className="mt-2 text-xs text-accent2">Koreksi tercatat.</p>}
        </form>
      )}
    </div>
  );
}
