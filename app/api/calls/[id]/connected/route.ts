import { ok, fail, requireUser } from "@/lib/api-util";

// POST /api/calls/[id]/connected — peserta menandai koneksi WebRTC terjalin.
// Penagihan HANYA berjalan setelah connected_at terisi (lihat settle_call).
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
    .select("id, status, male_user_id, female_creator_id, connected_at")
    .eq("id", id)
    .maybeSingle();
  const c = call as {
    id: string;
    status: string;
    male_user_id: string;
    female_creator_id: string;
    connected_at: string | null;
  } | null;
  if (
    !c ||
    (c.male_user_id !== user.id && c.female_creator_id !== user.id)
  ) {
    return fail("NOT_FOUND", 404);
  }
  if (c.status !== "ACCEPTED") return fail("INVALID_STATE", 409);
  if (c.connected_at) return ok({ call_id: id, already: true });

  const { error } = await svc
    .from("calls")
    .update({ connected_at: new Date().toISOString() })
    .eq("id", id)
    .is("connected_at", null);
  if (error) return fail("DB_ERROR", 500);
  return ok({ call_id: id });
}
