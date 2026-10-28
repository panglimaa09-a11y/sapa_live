"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { VideoCamera } from "@phosphor-icons/react";
import { useLang, usePageTitle } from "../../lib/i18n";
import { getSupabase, supabaseConfigured } from "../../lib/supabase";
import GoogleButton from "../../components/GoogleButton";

function isAdult(birth: string): boolean {
  const b = new Date(birth);
  if (isNaN(b.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return b <= cutoff;
}

const inputCls =
  "w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3.5 text-[15px] font-semibold text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none";

function RegisterForm() {
  const { t } = useLang();
  usePageTitle(t("nav.register"));
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birth, setBirth] = useState("");
  const [role, setRole] = useState<"MALE" | "FEMALE">("MALE");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref.trim().toUpperCase());
  }, [searchParams]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!agree || !isAdult(birth)) {
      setError(t("auth.age_error"));
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setError(t("common.error"));
      return;
    }
    setBusy(true);
    try {
      const { data, error: err } = await sb.auth.signUp({
        email: email.trim(),
        password,
      });
      if (err) throw err;
      const user = data.user;
      if (user) {
        let referredBy: string | null = null;
        const code = referralCode.trim().toUpperCase();
        if (code) {
          const { data: ref } = await sb
            .from("profiles")
            .select("id")
            .eq("referral_code", code)
            .maybeSingle();
          if (ref) referredBy = ref.id;
        }
        await sb.from("profiles").insert({
          id: user.id,
          display_name: name.trim(),
          birth_date: birth,
          age_verified: true,
          role,
          ...(referredBy ? { referred_by: referredBy } : {}),
        });
        await sb.from("wallets").insert({ user_id: user.id });
      }
      if (data.session) {
        router.replace("/dashboard");
      } else {
        setNotice(t("auth.check_email"));
      }
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
          {t("auth.create_account")}
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">{t("auth.register_sub")}</p>

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
        {notice && (
          <p className="mt-4 rounded-2xl border border-accent2/30 bg-accent2/10 px-4 py-3 text-sm text-accent2">
            {notice}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-bold">
              {t("auth.name")}
            </label>
            <input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              maxLength={40}
            />
          </div>
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
            <label htmlFor="password" className="mb-1.5 block text-sm font-bold">
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="birth" className="mb-1.5 block text-sm font-bold">
              {t("auth.birth_date")}
            </label>
            <input
              id="birth"
              type="date"
              required
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-bold">
              {t("auth.role_label")}
            </span>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t("auth.role_label")}>
              {(
                [
                  { v: "MALE", label: t("auth.role_male"), desc: t("auth.role_male_desc") },
                  { v: "FEMALE", label: t("auth.role_female"), desc: t("auth.role_female_desc") },
                ] as const
              ).map((r) => (
                <button
                  key={r.v}
                  type="button"
                  role="radio"
                  aria-checked={role === r.v}
                  onClick={() => setRole(r.v)}
                  className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                    role === r.v
                      ? "border-accent bg-accent/10"
                      : "border-white/10 bg-base hover:border-white/25"
                  }`}
                >
                  <span className="block font-extrabold">{r.label}</span>
                  <span className="mt-1 block text-xs text-ink-soft">{r.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-base p-4 text-sm">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 h-4 w-4 accent-accent"
            />
            <span className="font-semibold text-ink-soft">
              {t("auth.age_confirm")}{" "}
              <Link href="/terms" className="font-bold text-accent hover:underline">
                {t("auth.terms_link")}
              </Link>{" "}
              {t("auth.and")}{" "}
              <Link href="/privacy" className="font-bold text-accent hover:underline">
                {t("auth.privacy_link")}
              </Link>
              .
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink-soft">
              Kode referral <span className="font-normal">(opsional — dari teman yang mengundang)</span>
            </span>
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="Contoh: X7K2P9QW"
              maxLength={8}
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            disabled={busy || !supabaseConfigured}
            className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-extrabold text-white transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? t("common.loading") : t("auth.register_btn")}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs font-bold text-ink-soft">
          <span className="h-px flex-1 bg-white/10" />
          {t("auth.or")}
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <GoogleButton />

        <p className="mt-6 text-center text-sm text-ink-soft">
          {t("auth.have_account")}{" "}
          <Link href="/login" className="font-bold text-accent hover:underline">
            {t("nav.login")}
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16 text-center text-ink-soft">Memuat…</main>}>
      <RegisterForm />
    </Suspense>
  );
}
