import { ok, fail, readJson, requireUser } from "@/lib/api-util";
import { isEligibleCreator } from "@/lib/server";

// POST /api/creator/availability {is_available}
// Hanya mengatur preferensi ketersediaan. TIDAK mengubah creator_status
// (status aktivasi milik admin).
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;

  if (!isEligibleCreator(profile)) {
    return fail("NOT_ELIGIBLE_CREATOR", 403);
  }

  const body = await readJson(req);
  const isAvailable = body?.is_available === true;

  const { error } = await svc
    .from("profiles")
    .update({ is_available: isAvailable })
    .eq("id", user.id);
  if (error) return fail("DB_ERROR", 500);

  return ok({ is_available: isAvailable });
}
