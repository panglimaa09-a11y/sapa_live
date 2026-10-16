import { ok, fail, readJson, requireUser } from "@/lib/api-util";

// POST /api/admin/withdrawals/[id] {action, payment_reference?, failure_reason?}
// approve: REQUESTED → PROCESSING
// reject: REQUESTED → REJECTED (earnings dikembalikan ke AVAILABLE)
// mark_paid: PROCESSING → PAID (earnings WITHDRAWAL_REQUESTED → PAID)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { profile, svc } = ctx;
  if (!profile?.is_admin) return fail("NOT_ADMIN", 403);
  const { id } = await params;

  const body = await readJson(req);
  const action = body?.action;
  if (!["approve", "reject", "mark_paid"].includes(action as string)) {
    return fail("INVALID_ACTION", 400);
  }

  const { data: wd } = await svc
    .from("withdrawals")
    .select("id, creator_id, status")
    .eq("id", id)
    .maybeSingle();
  const w = wd as { id: string; creator_id: string; status: string } | null;
  if (!w) return fail("NOT_FOUND", 404);

  const now = new Date().toISOString();

  if (action === "approve") {
    if (w.status !== "REQUESTED") return fail("INVALID_STATE", 409);
    const { error } = await svc
      .from("withdrawals")
      .update({ status: "PROCESSING" })
      .eq("id", id)
      .eq("status", "REQUESTED");
    if (error) return fail("DB_ERROR", 500);
  } else if (action === "reject") {
    if (w.status !== "REQUESTED") return fail("INVALID_STATE", 409);
    const failureReason =
      typeof body?.failure_reason === "string"
        ? body.failure_reason.slice(0, 500)
        : null;
    const { error } = await svc
      .from("withdrawals")
      .update({ status: "REJECTED", failure_reason: failureReason })
      .eq("id", id)
      .eq("status", "REQUESTED");
    if (error) return fail("DB_ERROR", 500);
    // Kembalikan earnings ke AVAILABLE agar bisa ditarik lagi
    await svc
      .from("creator_earnings")
      .update({ status: "AVAILABLE" })
      .eq("creator_id", w.creator_id)
      .eq("status", "WITHDRAWAL_REQUESTED");
  } else {
    // mark_paid
    if (w.status !== "PROCESSING") return fail("INVALID_STATE", 409);
    const paymentReference =
      typeof body?.payment_reference === "string"
        ? body.payment_reference.slice(0, 200)
        : null;
    const { error } = await svc
      .from("withdrawals")
      .update({
        status: "PAID",
        payment_reference: paymentReference,
        processed_at: now,
      })
      .eq("id", id)
      .eq("status", "PROCESSING");
    if (error) return fail("DB_ERROR", 500);
    await svc
      .from("creator_earnings")
      .update({ status: "PAID" })
      .eq("creator_id", w.creator_id)
      .eq("status", "WITHDRAWAL_REQUESTED");
  }

  return ok({ withdrawal_id: id, action });
}
