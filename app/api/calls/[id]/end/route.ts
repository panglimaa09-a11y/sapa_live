import { ok, fail, readJson, requireUser } from "@/lib/api-util";

// POST /api/calls/[id]/end {end_reason?} — peserta mengakhiri.
// Penagihan atomik & idempoten via fungsi SQL settle_call.
export async function POST(
  req: Request,
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
  if (
    !c ||
    (c.male_user_id !== user.id && c.female_creator_id !== user.id)
  ) {
    return fail("NOT_FOUND", 404);
  }
  if (c.status === "ENDED") {
    // Idempoten: kembalikan ringkasan yang sudah ada
    const { data } = await svc.rpc("settle_call", {
      p_call_id: id,
      p_end_reason: "completed",
    });
    return ok({ ...(data as Record<string, unknown>) });
  }

  const body = await readJson(req);
  const endReason =
    typeof body?.end_reason === "string" && body.end_reason.length < 64
      ? body.end_reason
      : user.id === c.male_user_id
        ? "ended_by_user"
        : "ended_by_creator";

  const { data, error } = await svc.rpc("settle_call", {
    p_call_id: id,
    p_end_reason: endReason,
  });
  if (error) return fail("SETTLE_FAILED", 500);
  return ok({ ...(data as Record<string, unknown>) });
}
