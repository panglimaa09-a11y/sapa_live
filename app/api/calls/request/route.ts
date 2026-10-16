import { ok, fail, readJson, requireUser } from "@/lib/api-util";
import { isActiveUser } from "@/lib/server";
import { BILLING } from "@/lib/billing";

// POST /api/calls/request {creator_id}
// Semua pemeriksaan kelayakan & saldo dilakukan di server.
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;

  if (!isActiveUser(profile)) return fail("ACCOUNT_NOT_ELIGIBLE", 403);

  const body = await readJson(req);
  const creatorId =
    typeof body?.creator_id === "string" ? body.creator_id : "";
  if (!creatorId) return fail("CREATOR_ID_REQUIRED", 400);
  if (creatorId === user.id) return fail("CANNOT_CALL_SELF", 400);

  // Kelayakan dasar kreator (data nyata dari profiles)
  const { data: creator } = await svc
    .from("profiles")
    .select("id, role, verification_status, creator_status, account_status, is_available")
    .eq("id", creatorId)
    .maybeSingle();
  const c = creator as {
    id?: string;
    role?: string;
    account_status?: string;
    is_available?: boolean;
  } | null;
  if (!c || c.role !== "FEMALE" || c.account_status !== "ACTIVE") {
    return fail("CREATOR_INELIGIBLE", 403);
  }

  // Aturan Tuan: wanita yang belum verifikasi wajah HANYA bisa chat,
  // tidak bisa menerima panggilan video.
  const { data: fv } = await svc
    .from("verification_records")
    .select("user_id")
    .eq("user_id", creatorId)
    .not("face_verified_at", "is", null)
    .limit(1);
  if (!fv || fv.length === 0) {
    return fail("CREATOR_NOT_FACE_VERIFIED", 403);
  }

  // Relasi blokir dua arah
  const { data: blocks } = await svc
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${creatorId}),and(blocker_id.eq.${creatorId},blocked_id.eq.${user.id})`
    )
    .limit(1);
  if (blocks && blocks.length > 0) return fail("BLOCKED", 403);

  // Tarif & saldo (server-side, bukan dari klien)
  const { data: cp } = await svc
    .from("creator_profiles")
    .select("rate_tokens_per_interval")
    .eq("user_id", creatorId)
    .maybeSingle();
  const rate =
    (cp as { rate_tokens_per_interval?: number } | null)
      ?.rate_tokens_per_interval ?? BILLING.tokensPerInterval;

  const { data: wallet } = await svc
    .from("wallets")
    .select("tokens")
    .eq("user_id", user.id)
    .maybeSingle();
  const balance = (wallet as { tokens?: number } | null)?.tokens ?? 0;
  if (balance < rate) {
    return fail("INSUFFICIENT_BALANCE", 402, { required: rate, balance });
  }

  // Buat sesi panggilan
  const { data: call, error } = await svc
    .from("calls")
    .insert({
      male_user_id: user.id,
      female_creator_id: creatorId,
      status: "REQUESTED",
    })
    .select("id")
    .single();
  if (error || !call) return fail("DB_ERROR", 500);
  const callId = (call as { id: string }).id;

  // Aturan Tuan: kreator terverifikasi + toggle "Terima panggilan" ON
  // = otomatis terima, tanpa klik manual.
  const autoAccept = c.is_available === true;
  if (autoAccept) {
    await svc
      .from("calls")
      .update({ status: "ACCEPTED", accepted_at: new Date().toISOString() })
      .eq("id", callId)
      .eq("status", "REQUESTED");
    await svc.from("notifications").insert({
      user_id: creatorId,
      type: "call_accepted",
      title: "Panggilan masuk otomatis",
      body: "Panggilan video dimulai otomatis karena kamu sedang menerima panggilan.",
      meta: { call_id: callId },
    });
  } else {
    // Notifikasi ke kreator (via service_role, bypass RLS)
    await svc.from("notifications").insert({
      user_id: creatorId,
      type: "call_request",
      title: "Permintaan panggilan video",
      body: "Seseorang ingin mengobrol denganmu. Terima atau tolak.",
      meta: { call_id: callId },
    });
  }

  return ok({ call_id: callId, auto_accepted: autoAccept });
}
