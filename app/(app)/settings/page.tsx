"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "@phosphor-icons/react";
import { useLang, type Lang } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { getSupabase } from "../../../lib/supabase";

const inputCls =
  "w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3 text-[15px] font-semibold text-ink focus:border-accent focus:outline-none";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-base px-4 py-3.5"
    >
      <span className="text-sm font-bold">{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang } = useLang();
  const { user, profile, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [showOnline, setShowOnline] = useState(true);
  const [allowRandom, setAllowRandom] = useState(true);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setShowOnline(profile.show_online);
      setAllowRandom(profile.allow_random);
    }
  }, [profile]);

  const save = async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    setBusy(true);
    await sb
      .from("profiles")
      .update({
        display_name: name.trim().slice(0, 40) || profile?.display_name,
        language: lang,
        show_online: showOnline,
        allow_random: allowRandom,
      })
      .eq("id", user.id);
    setLang(lang);
    await refresh();
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const deleteAccount = async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    await sb.from("profiles").delete().eq("id", user.id);
    await sb.auth.signOut();
    router.replace("/");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t("settings.title")}
      </h1>

      <section className="mt-6 rounded-[28px] border border-white/10 bg-surface p-6">
        <h2 className="text-lg font-extrabold">{t("settings.profile")}</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-bold">
              {t("auth.name")}
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-base px-4 py-3.5 text-sm">
            <ShieldCheck size={20} className="shrink-0 text-accent2" />
            <span className="font-bold">{t("settings.age")}: </span>
            <span className="font-semibold text-accent2">
              {profile?.age_verified ? t("settings.verified") : "—"}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/10 bg-surface p-6">
        <h2 className="text-lg font-extrabold">{t("settings.language")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["id", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-2xl border-2 px-4 py-3 text-sm font-extrabold transition-colors ${
                lang === l
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-white/10 text-ink-soft hover:border-white/25"
              }`}
            >
              {l === "id" ? "Bahasa Indonesia" : "English"}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[28px] border border-white/10 bg-surface p-6">
        <h2 className="text-lg font-extrabold">{t("settings.privacy")}</h2>
        <div className="mt-4 space-y-3">
          <Toggle
            checked={showOnline}
            onChange={setShowOnline}
            label={t("settings.show_online")}
          />
          <Toggle
            checked={allowRandom}
            onChange={setAllowRandom}
            label={t("settings.allow_random")}
          />
        </div>
      </section>

      <button
        onClick={() => void save()}
        disabled={busy}
        className="mt-6 w-full rounded-2xl bg-accent px-6 py-4 text-base font-extrabold text-white disabled:opacity-60"
      >
        {busy ? t("common.loading") : t("settings.save")}
      </button>
      {saved && (
        <p className="mt-3 text-center text-sm font-bold text-accent2">
          {t("settings.saved")}
        </p>
      )}

      <section className="mt-8 rounded-[28px] border border-red-500/30 bg-red-500/5 p-6">
        <h2 className="text-lg font-extrabold text-red-300">
          {t("settings.danger")}
        </h2>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-4 rounded-2xl border-2 border-red-500/40 px-6 py-3 text-sm font-extrabold text-red-300 transition-colors hover:bg-red-500/10"
          >
            {t("settings.delete")}
          </button>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-ink-soft">{t("settings.delete_confirm")}</p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => void deleteAccount()}
                className="rounded-2xl bg-red-600 px-6 py-3 text-sm font-extrabold text-white"
              >
                {t("settings.delete")}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-2xl border border-white/15 px-6 py-3 text-sm font-bold text-ink-soft"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
