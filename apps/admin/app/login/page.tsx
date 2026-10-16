"use client";

import { useActionState } from "react";
import { loginAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-extrabold text-white">
            S
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            Panel Admin SapaLive
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Panel administrator. Akses terbatas & tercatat.
          </p>
        </div>

        <form
          action={formAction}
          className="rounded-3xl border border-white/10 bg-surface p-6 sm:p-8"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Email administrator</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="admin@contoh.id"
              className="w-full rounded-xl border border-white/10 bg-paper px-4 py-3 text-[15px] outline-none placeholder:text-ink-soft/50 focus:border-accent"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-sm font-bold">Kata sandi</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/10 bg-paper px-4 py-3 text-[15px] outline-none placeholder:text-ink-soft/50 focus:border-accent"
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
            {pending ? "Memeriksa…" : "Masuk"}
          </button>

          <p className="mt-5 text-center text-xs leading-relaxed text-ink-soft">
            Login dilindungi rate-limit dan MFA. Semua upaya login tercatat
            di audit log. Tidak ada pendaftaran admin publik.
          </p>
        </form>
      </div>
    </main>
  );
}
