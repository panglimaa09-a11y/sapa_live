import { ok } from "@/lib/api-util";
import { TOPUP_PACKAGES } from "@/lib/billing";

// Harga paket token (publik). Nilai final ditentukan Tuan sebelum produksi.
export async function GET() {
  return ok({ packages: TOPUP_PACKAGES });
}
