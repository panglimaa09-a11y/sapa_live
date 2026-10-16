"use client";

import { useActionState } from "react";
import { grantTokensAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function GrantForm() {
  const [state, formAction, pending] = useActionState(grantTokensAction, initial);
  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink-soft">
          Email user
        </span>
        <input
          name="email"
          type="email"
          required
          placeholder="user@example.com"
          className="w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3 text-[15px] font-semibold text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink-soft">
          Jumlah token
        </span>
        <input
          name="amount"
          type="number"
          min={1}
          max={100000}
          required
          placeholder="100"
          className="w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3 text-[15px] font-semibold text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink-soft">
          Catatan <span className="font-normal">(opsional)</span>
        </span>
        <input
          name="note"
          type="text"
          maxLength={200}
          placeholder="Alasan pemberian token"
          className="w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3 text-[15px] font-semibold text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none"
        />
      </label>
      {state.error ? (
        <p className="text-sm font-bold text-red-400">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm font-bold text-green-400">
          Token berhasil dikirim.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-accent px-4 py-3 font-extrabold text-white disabled:opacity-50"
      >
        {pending ? "Mengirim…" : "Kirim Token"}
      </button>
    </form>
  );
}
