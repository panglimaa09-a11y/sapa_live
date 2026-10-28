// avoid-ai-design-ignore-file: L1 (centered form app screen, deliberate)
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera } from "@phosphor-icons/react";
import { useLang } from "../../../../lib/i18n";
import { useSession } from "../../../../lib/session";
import { getSupabase } from "../../../../lib/supabase";
import FaceVerify, { type FaceVerifyResult } from "../_components/FaceVerify";

const inputCls =
  "w-full rounded-2xl border-2 border-white/10 bg-base px-4 py-3.5 text-[15px] font-semibold text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none";

export default function CreatorOnboardingPage() {
  const { t } = useLang();
  const { user, profile, refresh } = useSession();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [bio, setBio] = useState("");
  const [lang2, setLang2] = useState("id");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [faceResult, setFaceResult] = useState<FaceVerifyResult | null>(null);

  const isFemale = profile?.role === "FEMALE";
  const alreadyApplied =
    profile != null &&
    (profile.verification_status === "PENDING_VERIFICATION" ||
      profile.verification_status === "PENDING_REVIEW" ||
      profile.verification_status === "VERIFIED" ||
      profile.creator_status === "ACTIVE" ||
      profile.creator_status === "PENDING_REVIEW");

  useEffect(() => {
    if (profile && !isFemale) router.replace("/dashboard");
  }, [profile, isFemale, router]);

  const uploadAvatar = async (file: File) => {
    const sb = getSupabase();
    if (!sb || !user) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setError(t("onboarding.avatar_hint"));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await sb.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = sb.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agree) {
      setError(t("onboarding.terms"));
      return;
    }
    if (!faceResult?.passed) {
      setError("Verifikasi wajah wajib lolos sebelum mendaftar sebagai kreator.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/creator/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bio: bio.trim().slice(0, 500),
          preferred_language: lang2,
          avatar_url: avatarUrl,
          face_match_score: faceResult.matchScore,
          face_liveness_passed: faceResult.livenessPassed,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "failed");
      setDone(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  if (!isFemale) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-ink-soft">{t("onboarding.not_female")}</p>
        <Link href="/dashboard" className="mt-6 inline-block rounded-full bg-accent px-8 py-3.5 font-extrabold text-white">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  if (done || alreadyApplied) {
    return (
      <div className="mx-auto max-w-md py-16">
        <div className="rounded-[28px] border border-accent2/30 bg-accent2/5 p-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("onboarding.pending_title")}</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">{t("onboarding.pending_text")}</p>
          <Link href="/dashboard" className="mt-6 inline-block rounded-full bg-accent px-8 py-3.5 font-extrabold text-white">
            {t("common.back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-[28px] border border-white/10 bg-surface p-8">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("onboarding.title")}</h1>
        <p className="mt-2 text-[15px] text-ink-soft">{t("onboarding.sub")}</p>

        {error && (
          <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-bold">{t("onboarding.avatar")}</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-white/15 bg-base p-4 text-left transition-colors hover:border-accent"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-ink-soft">
                  <Camera size={28} aria-hidden />
                </span>
              )}
              <span className="text-sm">
                <span className="block font-bold text-accent">
                  {uploading ? t("onboarding.uploading") : avatarUrl ? t("onboarding.change_avatar") : t("onboarding.avatar")}
                </span>
                <span className="mt-1 block text-xs text-ink-soft">{t("onboarding.avatar_hint")}</span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
              }}
            />
          </div>

          <div>
            <label htmlFor="bio" className="mb-1.5 block text-sm font-bold">
              {t("onboarding.bio")}
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("onboarding.bio_ph")}
              maxLength={500}
              rows={4}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label htmlFor="olang" className="mb-1.5 block text-sm font-bold">
              {t("onboarding.language")}
            </label>
            <select
              id="olang"
              value={lang2}
              onChange={(e) => setLang2(e.target.value)}
              className={`${inputCls} [color-scheme:dark]`}
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-base p-4 text-sm">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 h-4 w-4 accent-accent"
            />
            <span className="font-semibold text-ink-soft">{t("onboarding.terms")}</span>
          </label>

          <FaceVerify profilePhotoUrl={avatarUrl} onResult={setFaceResult} />

          <button
            type="submit"
            disabled={busy || uploading || !faceResult?.passed}
            className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-extrabold text-white disabled:opacity-60"
          >
            {busy ? t("common.loading") : t("onboarding.submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
