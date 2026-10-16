// Sapa.live — klien Pakasir API v2 (payment_link).
// Port TypeScript dari ~/workspace/onerouter/bot/pakasir.py.
// Dipakai HANYA di server (route handlers). Jangan log API key.

const BASE = "https://app.pakasir.com/api/v2";

const PAID_STATUSES = new Set([
  "paid",
  "success",
  "settlement",
  "completed",
  "done",
  "lunas",
]);
const FAIL_STATUSES = new Set([
  "failed",
  "cancelled",
  "canceled",
  "rejected",
]);
const EXPIRED_STATUSES = new Set(["expired"]);

export class PakasirError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PakasirError";
  }
}

export type PakasirPayload = Record<string, unknown>;

function statusOf(payload: PakasirPayload): string {
  return String(payload["status"] ?? "").trim().toLowerCase();
}

export function isPaid(payload: PakasirPayload): boolean {
  return PAID_STATUSES.has(statusOf(payload));
}

export function isFailed(payload: PakasirPayload): boolean {
  return FAIL_STATUSES.has(statusOf(payload));
}

export function isExpired(payload: PakasirPayload): boolean {
  return EXPIRED_STATUSES.has(statusOf(payload));
}

async function req(
  method: "GET" | "POST",
  url: string,
  apiKey: string,
  body?: Record<string, unknown>
): Promise<{ status: number; payload: PakasirPayload }> {
  const res = await fetch(url, {
    method,
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload: PakasirPayload = {};
  try {
    payload = (await res.json()) as PakasirPayload;
  } catch {
    // biarkan payload kosong
  }
  return { status: res.status, payload };
}

/** Buat invoice payment_link. Return { txnId, paymentLink }. */
export async function createTransaction(
  slug: string,
  apiKey: string,
  orderId: string,
  amountIdr: number
): Promise<{ txnId: string; paymentLink: string }> {
  const url = `${BASE}/create-transaction/${slug}/${orderId}`;
  const { status, payload } = await req("POST", url, apiKey, {
    method: "payment_link",
    amount: Math.round(amountIdr),
  });
  const txnId = String(payload["txn_id"] ?? "").trim();
  const link = String(payload["payment_link"] ?? "").trim();
  if (status !== 200 || !txnId || !link.startsWith("https://")) {
    // Jangan sertakan apiKey di pesan error.
    throw new PakasirError(
      `create-transaction ditolak (http ${status}): ${JSON.stringify(payload).slice(0, 300)}`
    );
  }
  return { txnId, paymentLink: link };
}

/** Cek status transaksi. Return payload mentah dari Pakasir. */
export async function transactionStatus(
  slug: string,
  apiKey: string,
  txnId: string
): Promise<PakasirPayload> {
  const url = `${BASE}/transaction-status/${slug}/${txnId}`;
  const { status, payload } = await req("GET", url, apiKey);
  if (status === 429) {
    throw new PakasirError("rate limit Pakasir, coba lagi beberapa detik");
  }
  if (status !== 200) {
    throw new PakasirError(`status endpoint HTTP ${status}`);
  }
  return payload;
}
