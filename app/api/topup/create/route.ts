import { randomBytes } from "node:crypto";
import { ok, fail, readJson, requireUser } from "@/lib/api-util";
import { TOPUP_PACKAGES } from "@/lib/billing";
import { createTransaction } from "@/lib/pakasir";

// POST /api/topup/create {package_id}
// Membuat order + invoice Pakasir. Pembayaran & kredit saldo terjadi di /status.
export async function POST(req: Request) {
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, svc } = ctx;

  const body = await readJson(req);
  const packageId =
    typeof body?.package_id === "string" ? body.package_id : "";
  const pkg = TOPUP_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) return fail("INVALID_PACKAGE", 400);

  const slug = process.env.PAKASIR_PROJECT_SLUG;
  const apiKey = process.env.PAKASIR_API_KEY;
  if (!slug || !apiKey) return fail("TOPUP_UNCONFIGURED", 500);

  const orderId = `SLV-${randomBytes(4).toString("hex").toUpperCase()}`;

  const { data: order, error: insertErr } = await svc
    .from("topup_orders")
    .insert({
      user_id: user.id,
      package_id: pkg.id,
      tokens: pkg.tokens,
      amount_idr: pkg.idr,
      pakasir_order_id: orderId,
      status: "PENDING",
    })
    .select("id, pakasir_order_id")
    .single();
  if (insertErr || !order) return fail("DB_ERROR", 500);

  try {
    const { txnId, paymentLink } = await createTransaction(
      slug,
      apiKey,
      orderId,
      pkg.idr
    );
    await svc
      .from("topup_orders")
      .update({ pakasir_txn_id: txnId })
      .eq("id", (order as { id: string }).id);
    return ok({
      payment_link: paymentLink,
      order_id: (order as { pakasir_order_id: string }).pakasir_order_id,
    });
  } catch (e) {
    await svc
      .from("topup_orders")
      .update({ status: "FAILED" })
      .eq("id", (order as { id: string }).id);
    // Jangan bocorkan pesan mentah provider ke client — catat di server saja.
    console.error(
      `[topup] pakasir gagal untuk order ${(order as { id: string }).id}:`,
      e instanceof Error ? e.message : e
    );
    return fail("PAKASIR_ERROR", 502);
  }
}
