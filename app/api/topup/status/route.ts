import { ok, fail, requireUser } from "@/lib/api-util";
import {
  transactionStatus,
  isPaid,
  isFailed,
  isExpired,
  PakasirError,
} from "@/lib/pakasir";

// GET /api/topup/status?order_id=SLV-XXXXXXXX
// Mengecek status ke Pakasir; bila lunas → kredit atomik (sekali saja).
export async function GET(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, profile, svc } = ctx;

  const orderId = new URL(req.url).searchParams.get("order_id") ?? "";
  if (!orderId) return fail("ORDER_ID_REQUIRED", 400);

  const { data: order } = await svc
    .from("topup_orders")
    .select("*")
    .eq("pakasir_order_id", orderId)
    .maybeSingle();
  const o = order as {
    id: string;
    user_id: string;
    tokens: number;
    pakasir_txn_id: string | null;
    status: string;
  } | null;
  if (!o || (o.user_id !== user.id && !profile?.is_admin)) {
    return fail("NOT_FOUND", 404);
  }
  if (o.status === "PAID") {
    return ok({ status: "PAID", tokens_credited: o.tokens });
  }
  if (o.status !== "PENDING") {
    return ok({ status: o.status, tokens_credited: 0 });
  }
  if (!o.pakasir_txn_id) return ok({ status: "PENDING", tokens_credited: 0 });

  const slug = process.env.PAKASIR_PROJECT_SLUG;
  const apiKey = process.env.PAKASIR_API_KEY;
  if (!slug || !apiKey) return fail("TOPUP_UNCONFIGURED", 500);

  let payload;
  try {
    payload = await transactionStatus(slug, apiKey, o.pakasir_txn_id);
  } catch (e) {
    const msg = e instanceof PakasirError ? e.message : "pakasir error";
    return fail("PAKASIR_ERROR", 502, { detail: msg });
  }

  if (isPaid(payload)) {
    // Atomic guard: hanya satu pemenang yang boleh mengkredit.
    const { data: won } = await svc
      .from("topup_orders")
      .update({ status: "PAID", paid_at: new Date().toISOString() })
      .eq("id", o.id)
      .eq("status", "PENDING")
      .select("id");
    if (!won || (won as unknown[]).length === 0) {
      // Kalah race — order sudah diproses pemanggil lain.
      return ok({ status: "PAID", tokens_credited: o.tokens });
    }

    // Kredit atomik + ledger dalam satu transaksi DB (idempoten via txn_id).
    const { data: newBalance, error: creditErr } = await svc.rpc(
      "settle_topup",
      {
        p_user_id: o.user_id,
        p_amount: o.tokens,
        p_idempotency_key: o.pakasir_txn_id,
        p_reference_id: o.id,
      }
    );
    if (creditErr) {
      // Saldo gagal dikredit — kembalikan status agar bisa dicoba lagi.
      await svc
        .from("topup_orders")
        .update({ status: "PENDING", paid_at: null })
        .eq("id", o.id);
      return fail("CREDIT_FAILED", 500);
    }

    return ok({
      status: "PAID",
      tokens_credited: o.tokens,
      balance: newBalance as number,
    });
  }

  if (isExpired(payload)) {
    await svc
      .from("topup_orders")
      .update({ status: "EXPIRED" })
      .eq("id", o.id)
      .eq("status", "PENDING");
    return ok({ status: "EXPIRED", tokens_credited: 0 });
  }
  if (isFailed(payload)) {
    await svc
      .from("topup_orders")
      .update({ status: "FAILED" })
      .eq("id", o.id)
      .eq("status", "PENDING");
    return ok({ status: "FAILED", tokens_credited: 0 });
  }
  return ok({ status: "PENDING", tokens_credited: 0 });
}
