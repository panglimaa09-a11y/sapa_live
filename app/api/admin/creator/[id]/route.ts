import { ok, fail, readJson, requireUser } from "@/lib/api-util";

// POST /api/admin/creator/[id] {action: approve|reject|suspend|activate}
// Admin mengelola status kreator. Perubahan status HANYA lewat jalur ini.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;
  if (!profile?.is_admin) return fail("NOT_ADMIN", 403);
  const { id } = await params;

  const body = await readJson(req);
  const action = body?.action;
  if (!["approve", "reject", "suspend", "activate"].includes(action as string)) {
    return fail("INVALID_ACTION", 400);
  }

  const { data: target } = await svc
    .from("profiles")
    .select("id, verification_status, creator_status")
    .eq("id", id)
    .maybeSingle();
  if (!target) return fail("NOT_FOUND", 404);
  const t = target as {
    id: string;
    verification_status: string;
    creator_status: string;
  };

  const now = new Date().toISOString();

  if (action === "approve") {
    const { error } = await svc
      .from("profiles")
      .update({
        verification_status: "VERIFIED",
        creator_status: "ACTIVE",
        
      })
      .eq("id", id);
    if (error) return fail("DB_ERROR", 500);
    await svc
      .from("verification_records")
      .update({
        status: "APPROVED",
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("user_id", id)
      .eq("status", "PENDING");
  } else if (action === "reject") {
    const { error } = await svc
      .from("profiles")
      .update({
        verification_status: "REJECTED",
        creator_status: "INACTIVE",
        
      })
      .eq("id", id);
    if (error) return fail("DB_ERROR", 500);
    await svc
      .from("verification_records")
      .update({
        status: "REJECTED",
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("user_id", id)
      .eq("status", "PENDING");
  } else if (action === "suspend") {
    const { error } = await svc
      .from("profiles")
      .update({ creator_status: "SUSPENDED"})
      .eq("id", id);
    if (error) return fail("DB_ERROR", 500);
  } else {
    // activate — hanya bila sudah VERIFIED
    if (t.verification_status !== "VERIFIED") {
      return fail("NOT_VERIFIED", 400);
    }
    const { error } = await svc
      .from("profiles")
      .update({ creator_status: "ACTIVE"})
      .eq("id", id);
    if (error) return fail("DB_ERROR", 500);
  }

  return ok({ user_id: id, action });
}
