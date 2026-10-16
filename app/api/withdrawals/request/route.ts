import { ok, fail, readJson, requireUser } from "@/lib/api-util";
import { isEligibleCreator } from "@/lib/server";

// POST /api/withdrawals/request {amount_tokens}
// Kreator menarik penghasilan AVAILABLE. Earnings terkait ditandai
// WITHDRAWAL_REQUESTED agar tidak bisa ditarik dua kali.
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;

  if (!isEligibleCreator(profile)) {
    return fail("NOT_ELIGIBLE_CREATOR", 403);
  }

  const body = await readJson(req);
  const amount =
    typeof body?.amount_tokens === "number"
      ? Math.floor(body.amount_tokens)
      : 0;
  if (amount <= 0) return fail("INVALID_AMOUNT", 400);

  const { data: earnings } = await svc
    .from("creator_earnings")
    .select("id, net_tokens")
    .eq("creator_id", user.id)
    .eq("status", "AVAILABLE");
  const available = ((earnings ?? []) as { net_tokens: number }[]).reduce(
    (s, e) => s + e.net_tokens,
    0
  );
  if (available < amount) {
    return fail("INSUFFICIENT_EARNINGS", 400, { available });
  }

  const { data: wd, error: wdErr } = await svc
    .from("withdrawals")
    .insert({
      creator_id: user.id,
      amount_tokens: amount,
      status: "REQUESTED",
    })
    .select("id")
    .single();
  if (wdErr || !wd) return fail("DB_ERROR", 500);

  // Tandai earnings AVAILABLE agar tidak double-claim.
  // (Penyederhanaan: tandai semua; nominal pasti tercatat di withdrawal.)
  const { error: markErr } = await svc
    .from("creator_earnings")
    .update({ status: "WITHDRAWAL_REQUESTED" })
    .eq("creator_id", user.id)
    .eq("status", "AVAILABLE");
  if (markErr) return fail("DB_ERROR", 500);

  return ok({ withdrawal_id: (wd as { id: string }).id });
}
