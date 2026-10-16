import { ok, fail, readJson, requireUser } from "@/lib/api-util";
import { isActiveUser } from "@/lib/server";

// POST /api/chats/start {user_id}
// Mulai thread chat tanpa panggilan video — untuk wanita yang belum
// verifikasi wajah (aturan Tuan: mereka hanya bisa chat).
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;

  if (!isActiveUser(profile)) return fail("ACCOUNT_NOT_ELIGIBLE", 403);

  const body = await readJson(req);
  const targetId =
    typeof body?.user_id === "string" ? body.user_id : "";
  if (!targetId) return fail("USER_ID_REQUIRED", 400);
  if (targetId === user.id) return fail("CANNOT_CHAT_SELF", 400);

  // Target harus user aktif
  const { data: target } = await svc
    .from("profiles")
    .select("id, role, account_status")
    .eq("id", targetId)
    .maybeSingle();
  const t = target as {
    id?: string;
    role?: string;
    account_status?: string;
  } | null;
  if (!t || t.account_status !== "ACTIVE") {
    return fail("USER_NOT_FOUND", 404);
  }

  // Relasi blokir dua arah
  const { data: blocks } = await svc
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${user.id})`
    )
    .limit(1);
  if (blocks && blocks.length > 0) return fail("BLOCKED", 403);

  // Thread yang sudah ada (dua arah, belum diakhiri)
  const { data: existing } = await svc
    .from("matches")
    .select("id")
    .or(
      `and(user_a.eq.${user.id},user_b.eq.${targetId}),and(user_a.eq.${targetId},user_b.eq.${user.id})`
    )
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return ok({ match_id: (existing as { id: string }).id, existing: true });
  }

  // Buat thread chat baru (room_id unik, bukan untuk video call)
  const roomId = `chat-${crypto.randomUUID()}`;
  const { data: created, error } = await svc
    .from("matches")
    .insert({ room_id: roomId, user_a: user.id, user_b: targetId })
    .select("id")
    .single();
  if (error || !created) return fail("DB_ERROR", 500);

  return ok({ match_id: (created as { id: string }).id, existing: false });
}
