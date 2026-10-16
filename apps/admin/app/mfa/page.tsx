"use client";

import { useActionState } from "react";
import { verifyMfaAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export default function MfaPage() {
  const [state, formAction, pending] = useActionState(verifyMfaAction, initial);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Verifikasi dua langkah
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Masukkan kode 6 digit dari aplikasi authenticator.
          </p>
        </div>

        <form
          action={formAction}
          className="rounded-3xl border border-white/10 bg-surface p-6 sm:p-8"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Kode authenticator</span>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              placeholder="123456"
              className="w-full rounded-xl border border-white/10 bg-paper px-4 py-3 text-center text-2xl font-extrabold tracking-[0.5em] outline-none placeholder:text-ink-soft/30 focus:border-accent"
            />
          </label>

          {state.error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-full bg-accent py-3.5 font-extrabold text-white transition-opacity disabled:opacity-60"
          >
            {pending ? "Memverifikasi…" : "Verifikasi"}
          </button>
        </form>
      </div>
    </main>
  );
}
