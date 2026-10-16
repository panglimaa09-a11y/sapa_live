import { ok, fail, readJson, requireUser } from "@/lib/api-util";

// POST /api/creator/apply {bio?, preferred_language?, avatar_url?}
// Pendaftaran kreator: HANYA role FEMALE yang sudah age_verified.
// Status akhir (VERIFIED/ACTIVE) HANYA bisa diubah admin via service_role.
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;

  if (profile?.role !== "FEMALE") return fail("NOT_FEMALE", 403);
  if (profile?.age_verified !== true) return fail("AGE_REQUIRED", 403);
  if (profile?.account_status !== "ACTIVE") {
    return fail("ACCOUNT_NOT_ELIGIBLE", 403);
  }

  const body = await readJson(req);
  const bio =
    typeof body?.bio === "string" ? body.bio.slice(0, 500) : null;
  const preferredLanguage =
    typeof body?.preferred_language === "string" &&
    ["id", "en"].includes(body.preferred_language)
      ? body.preferred_language
      : "id";
  const avatarUrl =
    typeof body?.avatar_url === "string" && body.avatar_url.startsWith("https://")
      ? body.avatar_url
      : null;

  // Verifikasi wajah: skor jarak descriptor (0 = identik). Wajib lolos di client.
  // Server TIDAK menerima foto/data wajah — hanya skor (privasi by design).
  // Validasi rentang untuk menolak data asal-asalan.
  const faceScore = body?.face_match_score;
  const faceLiveness = body?.face_liveness_passed;
  if (typeof faceScore !== "number" || !(faceScore >= 0 && faceScore < 0.6)) {
    return fail("FACE_NOT_VERIFIED", 403);
  }
  if (faceLiveness !== true) {
    return fail("FACE_NOT_VERIFIED", 403);
  }

  const { error: upsertErr } = await svc.from("creator_profiles").upsert(
    {
      user_id: user.id,
      bio,
      preferred_language: preferredLanguage,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertErr) return fail("DB_ERROR", 500);

  const { error: profileErr } = await svc
    .from("profiles")
    .update({
      verification_status: "PENDING_REVIEW",
      creator_status: "PENDING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (profileErr) return fail("DB_ERROR", 500);

  await svc.from("verification_records").insert({
    user_id: user.id,
    provider: "FACE_MATCH_LIVE",
    verification_type: "IDENTITY_FACE",
    status: "PENDING",
    provider_reference: `face_score=${faceScore.toFixed(3)};liveness=pass`,
    face_match_score: Math.round(faceScore * 1000) / 1000,
    face_liveness_passed: true,
    face_verified_at: new Date().toISOString(),
  });

  return ok({ status: "PENDING_REVIEW" });
}
