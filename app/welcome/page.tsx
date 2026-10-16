"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "../../lib/i18n";
import { getSupabase } from "../../lib/supabase";

function isAdult(birth: string): boolean {
  const b = new Date(birth);
  if (isNaN(b.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return b <= cutoff;
}

const inputCls =
  "w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3.5 text-[15px] font-semibold text-ink focus:border-accent focus:outline-none";

/** Pasca-login: pastikan profil lengkap (khususnya login Google pertama). */
export default function WelcomePage() {
  const { t } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [role, setRole] = useState<"MALE" | "FEMALE">("MALE");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb) {
        router.replace("/login");
        return;
      }
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await sb
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        router.replace("/dashboard");
        return;
      }
      setName(
        (user.user_metadata?.full_name as string) ||
          (user.email?.split("@")[0] ?? "")
      );
      setLoading(false);
    })();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agree || !isAdult(birth)) {
      setError(t("auth.age_error"));
      return;
    }
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    try {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("no-user");
      const { error: err } = await sb.from("profiles").insert({
        id: user.id,
        display_name: name.trim().slice(0, 40) || "Pengguna",
        birth_date: birth,
        age_verified: true,
        role,
      });
      if (err) throw err;
      await sb.from("wallets").insert({ user_id: user.id });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-[28px] border border-white/10 bg-surface p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {t("auth.complete_profile")}
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">{t("auth.complete_sub")}</p>
        {error && (
          <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
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
              className="mt-1 h-4 w-4 accent-[#6c7cff]"
            />
            <span className="font-semibold text-ink-soft">{t("auth.age_confirm")}</span>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-extrabold text-white disabled:opacity-60"
          >
            {busy ? t("common.loading") : t("common.save")}
          </button>
        </form>
      </div>
    </main>
  );
}
