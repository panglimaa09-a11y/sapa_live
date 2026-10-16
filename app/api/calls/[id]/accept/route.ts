import { ok, fail, requireUser } from "@/lib/api-util";

// POST /api/calls/[id]/accept — hanya female_creator_id.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, svc } = ctx;
  const { id } = await params;

  const { data: call } = await svc
    .from("calls")
    .select("id, status, male_user_id, female_creator_id")
    .eq("id", id)
    .maybeSingle();
  const c = call as {
    id: string;
    status: string;
    male_user_id: string;
    female_creator_id: string;
  } | null;
  if (!c || c.female_creator_id !== user.id) return fail("NOT_CREATOR", 403);
  if (c.status !== "REQUESTED") return fail("INVALID_STATE", 409);

  // Re-cek kelayakan kreator saat menerima: harus verifikasi wajah
  // (aturan Tuan: belum verifikasi wajah = chat aja, bukan video call)
  const { data: me } = await svc
    .from("profiles")
    .select("role, account_status")
    .eq("id", user.id)
    .maybeSingle();
  const m = me as { role?: string; account_status?: string } | null;
  if (!m || m.role !== "FEMALE" || m.account_status !== "ACTIVE") {
    return fail("CREATOR_INELIGIBLE", 403);
  }
  const { data: myFv } = await svc
    .from("verification_records")
    .select("user_id")
    .eq("user_id", user.id)
    .not("face_verified_at", "is", null)
    .limit(1);
  if (!myFv || myFv.length === 0) {
    return fail("CREATOR_NOT_FACE_VERIFIED", 403);
  }

  const { error } = await svc
    .from("calls")
    .update({ status: "ACCEPTED", accepted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "REQUESTED");
  if (error) return fail("DB_ERROR", 500);

  await svc.from("notifications").insert({
    user_id: c.male_user_id,
    type: "call_accepted",
    title: "Panggilan diterima",
    body: "Kreator menerima panggilanmu. Bersiap untuk video call.",
    meta: { call_id: id },
  });

  return ok({ call_id: id, status: "ACCEPTED" });
}
