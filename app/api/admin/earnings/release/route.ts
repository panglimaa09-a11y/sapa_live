import { ok, fail, readJson, requireUser } from "@/lib/api-util";

// POST /api/admin/earnings/release {earning_id}
// PENDING → AVAILABLE (setelah masa peninjauan / pemeriksaan fraud).
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { profile, svc } = ctx;
  if (!profile?.is_admin) return fail("NOT_ADMIN", 403);

  const body = await readJson(req);
  const earningId =
    typeof body?.earning_id === "string" ? body.earning_id : "";
  if (!earningId) return fail("EARNING_ID_REQUIRED", 400);

  const { data: updated } = await svc
    .from("creator_earnings")
    .update({
      status: "AVAILABLE",
      available_at: new Date().toISOString(),
    })
    .eq("id", earningId)
    .eq("status", "PENDING")
    .select("id");
  if (!updated || (updated as unknown[]).length === 0) {
    return fail("INVALID_STATE", 409);
  }
  return ok({ earning_id: earningId, status: "AVAILABLE" });
}
