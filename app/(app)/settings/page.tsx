"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ShieldCheck, SignOut } from "@phosphor-icons/react";
import { useLang, usePageTitle, type Lang } from "../../../lib/i18n";
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
  usePageTitle(t("nav.settings"));
  const { user, profile, refresh } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [showOnline, setShowOnline] = useState(true);
  const [allowRandom, setAllowRandom] = useState(true);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setBio(profile.bio ?? "");
      setShowOnline(profile.show_online);
      setAllowRandom(profile.allow_random);
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const uploadAvatar = async (file: File) => {
    const sb = getSupabase();
    if (!sb || !user) return;
    setAvatarError("");
    if (!file.type.startsWith("image/")) {
      setAvatarError("File harus gambar.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Ukuran maksimal 2MB.");
      return;
    }
    setUploading(true);
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await sb.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = sb.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await sb.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      await refresh();
    } catch {
      setAvatarError("Gagal mengunggah foto. Coba lagi.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const sb = getSupabase();
    if (!sb || !user) return;
    setBusy(true);
    await sb
      .from("profiles")
      .update({
        display_name: name.trim().slice(0, 40) || profile?.display_name,
        bio: bio.trim().slice(0, 300) || null,
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

  const signOut = async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
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
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border-2 border-white/10 bg-base"
              aria-label="Ganti foto profil"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-ink-soft">
                  {(name || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/50 py-1">
                <Camera size={14} className="text-white" />
              </span>
              {uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white">
                  ...
                </span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
            <p className="text-xs font-semibold text-ink-soft">
              Foto profil — dipakai juga untuk verifikasi wajah kreator.
            </p>
            {avatarError && (
              <p className="text-xs font-bold text-red-400">{avatarError}</p>
            )}
          </div>
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
          <div>
            <label htmlFor="bio" className="mb-1.5 block text-sm font-bold">
              {t("settings.bio")}
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder={t("settings.bio_ph")}
              className={`${inputCls} resize-none`}
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

      <section className="mt-8 rounded-[28px] border border-white/10 bg-surface p-6">
        <h2 className="text-lg font-extrabold tracking-tight">
          {t("settings.account")}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{t("settings.account_desc")}</p>
        <button
          onClick={() => void signOut()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-white/15 px-6 py-4 text-base font-extrabold text-ink transition-colors hover:border-white/30"
        >
          <SignOut size={20} weight="bold" aria-hidden />
          {t("nav.logout")}
        </button>
      </section>

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

      <section className="rounded-3xl border border-white/10 bg-surface p-6">
        <h2 className="text-lg font-extrabold">Undang Teman</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Bagikan kode referral kamu. Setiap teman yang daftar pakai kodemu{" "}
          <strong>dan lolos verifikasi wajah</strong> → kamu dapat{" "}
          <strong>17 token</strong>.
        </p>
        {(profile as any)?.referral_code ? (
          <div className="mt-4 flex items-center gap-3">
            <code className="rounded-2xl bg-base px-5 py-3 text-2xl font-extrabold tracking-widest text-accent">
              {(profile as any).referral_code}
            </code>
            <button
              onClick={() => {
                const code = (profile as any).referral_code;
                const url = `${window.location.origin}/register?ref=${code}`;
                navigator.clipboard.writeText(url).then(() =>
                  alert("Link undangan tersalin!")
                );
              }}
              className="rounded-2xl bg-accent px-4 py-3 font-extrabold text-white"
            >
              Salin Link
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-soft">Memuat kode referral…</p>
        )}
      </section>
    </div>
  );
}
