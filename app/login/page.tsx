"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { VideoCamera } from "@phosphor-icons/react";
import { useLang, usePageTitle } from "../../lib/i18n";
import { getSupabase, supabaseConfigured } from "../../lib/supabase";
import GoogleButton from "../../components/GoogleButton";

const inputCls =
  "w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3.5 text-[15px] font-semibold text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-12 text-center text-ink-soft">
          Memuat…
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const { t } = useLang();
  usePageTitle(t("auth.login_btn"));
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Error dari callback OAuth (mis. Google login gagal)
  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setError(t("auth.oauth_failed"));
    }
  }, [searchParams, t]);
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const forgotPassword = async () => {
    setError("");
    setResetSent(false);
    const sb = getSupabase();
    if (!sb || !email.trim()) {
      setError(t("auth.reset_need_email"));
      return;
    }
    setResetBusy(true);
    try {
      const { error: err } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (err) throw err;
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setResetBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const sb = getSupabase();
    if (!sb) {
      setError(t("common.error"));
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      router.replace("/welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mx-auto flex items-center gap-2" aria-label="SapaLive">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
          <VideoCamera size={24} weight="fill" aria-hidden />
        </span>
        <span className="text-3xl font-extrabold tracking-tight">
          Sapa<span className="text-accent">Live</span>
        </span>
      </Link>

      <div className="mt-8 rounded-[28px] border border-white/10 bg-surface p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t("auth.welcome_back")}
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">{t("auth.login_sub")}</p>

        {!supabaseConfigured && (
          <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            Mode demo: Supabase belum dikonfigurasi.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-bold">
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-bold">
                {t("auth.password")}
              </label>
              <button
                type="button"
                onClick={() => void forgotPassword()}
                disabled={resetBusy}
                className="text-sm font-bold text-accent hover:underline disabled:opacity-60"
              >
                {t("auth.forgot")}
              </button>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          {resetSent && (
            <p className="rounded-2xl border border-accent2/30 bg-accent2/10 px-4 py-3 text-sm text-accent2">
              {t("auth.reset_sent")}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !supabaseConfigured}
            className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-extrabold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? t("common.loading") : t("auth.login_btn")}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs font-bold text-ink-soft">
          <span className="h-px flex-1 bg-white/10" />
          {t("auth.or")}
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <GoogleButton />

        <p className="mt-6 text-center text-sm text-ink-soft">
          {t("auth.no_account")}{" "}
          <Link href="/register" className="font-bold text-accent hover:underline">
            {t("nav.register")}
          </Link>
        </p>
      </div>
    </main>
  );
}
