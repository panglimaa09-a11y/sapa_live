"use client";

import { useActionState, useState } from "react";
import { updateBillingConfigAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function ConfigForm({ configKey, current }: { configKey: string; current: string }) {
  const [state, formAction, pending] = useActionState(updateBillingConfigAction, initial);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink"
        >
          Ubah
        </button>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="key" value={configKey} />
          <input
            name="value"
            required
            defaultValue={current}
            className="w-40 rounded-xl border border-white/10 bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {pending ? "…" : "Simpan"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-ink-soft">
            Batal
          </button>
        </form>
      )}
      {state.error && <p className="mt-1 text-xs text-red-300">{state.error}</p>}
      {state.ok && <p className="mt-1 text-xs text-accent2">Tersimpan & tercatat.</p>}
    </div>
  );
}
