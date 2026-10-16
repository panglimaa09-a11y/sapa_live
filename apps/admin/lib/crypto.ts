// ============================================================================
// SERVER ONLY — kriptografi admin: enkripsi secret TOTP (AES-256-GCM) dan
// penandatanganan cookie MFA (HMAC-SHA256). Memakai node:crypto.
// JANGAN impor dari client components atau dari proxy.ts (pakai WebCrypto di sana).
// ============================================================================
import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function key32(): Buffer {
  const raw = process.env.ADMIN_MFA_ENCRYPTION_KEY ?? "";
  if (!raw) throw new Error("ADMIN_MFA_ENCRYPTION_KEY belum dikonfigurasi");
  // Turunkan ke 32 byte agar panjang kunci fleksibel namun deterministik.
  return createHash("sha256").update(raw, "utf8").digest();
}

/** Enkripsi secret TOTP menjadi format "iv.ct.tag" (base64). */
// avoid-ai-design-ignore: CP3 (panah di komentar dokumentasi, bukan CTA)
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key32(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${ct.toString("base64")}.${tag.toString("base64")}`;
}

/** Dekripsi hasil encryptSecret. */
export function decryptSecret(enc: string): string {
  const [ivB64, ctB64, tagB64] = enc.split(".");
  if (!ivB64 || !ctB64 || !tagB64) throw new Error("Format secret terenkripsi tidak valid");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key32(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const MFA_COOKIE_MAX_AGE = 12 * 60 * 60; // 12 jam

/** Buat nilai cookie admfa: "userId.exp.sigHex". */
export function signMfaCookie(userId: string): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + MFA_COOKIE_MAX_AGE;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", key32()).update(payload, "utf8").digest("hex");
  return { value: `${payload}.${sig}`, maxAge: MFA_COOKIE_MAX_AGE };
}

/** Verifikasi cookie admfa → userId, atau null jika tidak valid/kedaluwarsa. */
export function verifyMfaCookie(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  const payload = `${userId}.${exp}`;
  const expected = createHmac("sha256", key32()).update(payload, "utf8").digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(sig, "hex");
  } catch {
    return null;
  }
  if (actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;
  return userId;
}
