"use client";

import { useActionState, useState } from "react";
import { suspendUserAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function SuspendForm({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [state, formAction, pending] = useActionState(suspendUserAction, initial);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="suspend" value={suspended ? "0" : "1"} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">
          Alasan {suspended ? "pengaktifan" : "penangguhan"}
        </span>
        <textarea
          name="reason"
          required
          minLength={5}
          rows={2}
          placeholder="Contoh: pelanggaran berulang setelah peringatan…"
          className="w-full rounded-xl border border-white/10 bg-paper px-4 py-2.5 text-sm outline-none placeholder:text-ink-soft/50 focus:border-accent"
        />
      </label>
      {state.error && (
        <p role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-3 rounded-xl border border-accent2/30 bg-accent2/10 px-4 py-2.5 text-sm text-accent2">
          Berhasil diperbarui.
        </p>
      )}
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={`mt-4 rounded-full px-6 py-2.5 text-sm font-extrabold ${
            suspended ? "bg-accent text-white" : "bg-red-600 text-white"
          }`}
        >
          {suspended ? "Aktifkan akun" : "Tangguhkan akun"}
        </button>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className={`rounded-full px-6 py-2.5 text-sm font-extrabold text-white disabled:opacity-60 ${
              suspended ? "bg-accent" : "bg-red-600"
            }`}
          >
            {pending ? "Memproses…" : "Ya, lanjutkan"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-bold text-ink-soft"
          >
            Batal
          </button>
        </div>
      )}
    </form>
  );
}
