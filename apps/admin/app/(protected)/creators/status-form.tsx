"use client";

import { useActionState, useState } from "react";
import { setCreatorStatusAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function CreatorStatusForm({
  userId,
  current,
}: {
  userId: string;
  current: string;
}) {
  const [state, formAction, pending] = useActionState(setCreatorStatusAction, initial);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink"
        >
          Ubah status
        </button>
      ) : (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="user_id" value={userId} />
          <select
            name="status"
            defaultValue={current}
            className="rounded-xl border border-white/10 bg-paper px-3 py-2 text-xs"
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
          <input
            name="reason"
            required
            minLength={5}
            placeholder="Alasan (wajib)"
            className="w-44 rounded-xl border border-white/10 bg-paper px-3 py-2 text-xs outline-none placeholder:text-ink-soft/50 focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-accent px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {pending ? "…" : "Simpan"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-bold text-ink-soft"
          >
            Batal
          </button>
          {state.error && <p className="w-full text-xs text-red-300">{state.error}</p>}
          {state.ok && <p className="w-full text-xs text-accent2">Tersimpan.</p>}
        </form>
      )}
    </div>
  );
}
