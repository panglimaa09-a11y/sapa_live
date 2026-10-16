import { ok, fail, requireUser } from "@/lib/api-util";

// GET /api/calls/[id] — hanya peserta atau admin.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;
  const { id } = await params;

  const { data: call } = await svc
    .from("calls")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const c = call as {
    male_user_id: string;
    female_creator_id: string;
  } | null;
  if (
    !c ||
    (c.male_user_id !== user.id &&
      c.female_creator_id !== user.id &&
      !profile?.is_admin)
  ) {
    return fail("NOT_FOUND", 404);
  }
  return ok({ call });
}
