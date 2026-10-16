import { ok, fail, readJson, requireUser } from "@/lib/api-util";
import { isActiveUser } from "@/lib/server";
import { BILLING } from "@/lib/billing";

// POST /api/calls/random {peer_id, room_id}
// Membuat sesi penagihan untuk matchmaking acak. Caller (pembuat request)
// adalah pihak yang membayar; platform memegang 100% karena peer belum
// tentu kreator (lihat settle_call: is_random_match=true → tanpa creator_earnings).
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;

  if (!isActiveUser(profile)) return fail("ACCOUNT_NOT_ELIGIBLE", 403);

  const body = await readJson(req);
  const peerId = typeof body?.peer_id === "string" ? body.peer_id : "";
  const roomId = typeof body?.room_id === "string" ? body.room_id : "";
  if (!peerId) return fail("PEER_ID_REQUIRED", 400);
  if (!roomId) return fail("ROOM_ID_REQUIRED", 400);
  if (peerId === user.id) return fail("CANNOT_CALL_SELF", 400);

  // Relasi blokir dua arah
  const { data: blocks } = await svc
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${peerId}),and(blocker_id.eq.${peerId},blocked_id.eq.${user.id})`
    )
    .limit(1);
  if (blocks && blocks.length > 0) return fail("BLOCKED", 403);

  // Tarif dari billing_config (server-side, bukan dari klien)
  const { data: cfg } = await svc
    .from("billing_config")
    .select("key, value")
    .in("key", ["tokens_per_interval", "interval_seconds"]);
  const cfgMap = new Map(
    ((cfg ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value])
  );
  const rate =
    Number.parseInt(cfgMap.get("tokens_per_interval") ?? "", 10) ||
    BILLING.tokensPerInterval;
  const intervalSeconds =
    Number.parseInt(cfgMap.get("interval_seconds") ?? "", 10) ||
    BILLING.intervalSeconds;

  // Saldo caller harus cukup untuk minimal 1 interval
  const { data: wallet } = await svc
    .from("wallets")
    .select("tokens")
    .eq("user_id", user.id)
    .maybeSingle();
  const balance = (wallet as { tokens?: number } | null)?.tokens ?? 0;
  if (balance < rate) {
    return fail("INSUFFICIENT_BALANCE", 402, { required: rate, balance });
  }

  // Buat sesi panggilan match acak — langsung ACCEPTED karena match
  // sudah disepakati kedua belah pihak via matchmaking.
  const { data: call, error } = await svc
    .from("calls")
    .insert({
      male_user_id: user.id,
      female_creator_id: peerId,
      status: "ACCEPTED",
      is_random_match: true,
      room_id: roomId,
    })
    .select("id")
    .single();
  if (error || !call) return fail("DB_ERROR", 500);

  return ok({
    call_id: (call as { id: string }).id,
    rate,
    interval_seconds: intervalSeconds,
  });
}
