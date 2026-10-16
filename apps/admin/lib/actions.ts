// ============================================================================
// SERVER ONLY — semua aksi tulis admin. Setiap aksi: cek izin → eksekusi via
// service_role → catat audit log. Tidak ada penulisan langsung dari client.
// ============================================================================
"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient, getSessionClient } from "./supabase";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import {
  decryptSecret,
  encryptSecret,
  signMfaCookie,
} from "./crypto";
import { checkRateLimit } from "./rate-limit";
import { requirePermission, getPreMfaSession } from "./auth";
import { logAudit } from "./audit";

export type ActionResult = { ok: boolean; error?: string };

const MFA_COOKIE = "admfa";
const ENROLL_COOKIE = "admfa_enroll";

// otplib v12: window diatur via instance options, bukan argumen verify().
// Toleransi ±1 langkah (30 dtk) untuk skew jam authenticator.
const totp = authenticator.create({ window: 1 });

function cookieOpts(maxAge: number) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

function need(v: FormDataEntryValue | null, min = 1): string | null {
  const s = String(v ?? "").trim();
  return s.length >= min ? s : null;
}

/** Login email+password. Pesan error dibuat generik agar tidak membocorkan info. */
export async function loginAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  "use server";
  const ip = await clientIp();
  const rl = checkRateLimit(`login:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    await logAudit(null, "auth.login_rate_limited", "auth", null, { ip });
    return {
      ok: false,
      error: `Terlalu banyak percobaan. Coba lagi dalam ${rl.retryAfterSec} detik.`,
    };
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Email dan kata sandi wajib diisi." };
  }

  try {
    const supabase = await getSessionClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      await logAudit(null, "auth.login_failed", "auth", null, { ip, email });
      return { ok: false, error: "Email atau kata sandi salah." };
    }

    const svc = getServiceClient();
    const { data: roleRow } = await svc
      .from("admin_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (!roleRow?.role) {
      // Bukan staf: cabut sesi yang baru dibuat, pesan tetap generik.
      await supabase.auth.signOut();
      await logAudit(data.user.id, "auth.login_denied_not_staff", "auth", null, {
        ip,
      });
      return { ok: false, error: "Email atau kata sandi salah." };
    }

    await logAudit(data.user.id, "auth.login_ok", "auth", null, {
      ip,
      role: roleRow.role,
    });

    const { data: mfaRow } = await svc
      .from("admin_mfa")
      .select("enabled")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (mfaRow && mfaRow.enabled !== false) redirect("/mfa");
    redirect("/mfa-setup");
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    return { ok: false, error: "Login gagal. Coba lagi." };
  }
}

/** Mulai enroll MFA: generate secret, simpan terenkripsi di cookie sementara,
 *  kembalikan QR. Dipanggil dari client saat halaman dibuka. */
export async function startMfaEnrollAction(): Promise<
  { ok: true; qrDataUrl: string; email: string } | { ok: false; error: string }
> {
  "use server";
  const s = await getPreMfaSession();
  if (!s) return { ok: false, error: "Sesi tidak valid." };
  const svc = getServiceClient();
  const { data: existing } = await svc
    .from("admin_mfa")
    .select("user_id")
    .eq("user_id", s.userId)
    .maybeSingle();
  if (existing) return { ok: false, error: "MFA sudah aktif." };

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(
    s.email || "admin",
    "SapaLive Admin",
    secret
  );
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  const store = await cookies();
  store.set(ENROLL_COOKIE, encryptSecret(secret), cookieOpts(10 * 60));
  return { ok: true, qrDataUrl, email: s.email };
}

/** Konfirmasi enroll: verifikasi kode lalu simpan secret terenkripsi. */
export async function confirmMfaEnrollAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  "use server";
  const s = await getPreMfaSession();
  if (!s) return { ok: false, error: "Sesi tidak valid." };
  const code = String(form.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Kode harus 6 digit." };
  }
  const store = await cookies();
  const enc = store.get(ENROLL_COOKIE)?.value;
  if (!enc) return { ok: false, error: "Sesi enroll kedaluwarsa. Muat ulang halaman." };
  let secret: string;
  try {
    secret = decryptSecret(enc);
  } catch {
    return { ok: false, error: "Sesi enroll rusak. Muat ulang halaman." };
  }
  const valid = totp.verify({ token: code, secret });
  if (!valid) {
    await logAudit(s.userId, "auth.mfa_enroll_failed", "auth", null, {});
    return { ok: false, error: "Kode salah. Coba lagi." };
  }
  const svc = getServiceClient();
  const { error } = await svc.from("admin_mfa").upsert({
    user_id: s.userId,
    secret_encrypted: encryptSecret(secret),
    enabled: true,
  });
  if (error) return { ok: false, error: "Gagal menyimpan MFA." };

  store.delete(ENROLL_COOKIE);
  const { value, maxAge } = signMfaCookie(s.userId);
  store.set(MFA_COOKIE, value, cookieOpts(maxAge));
  await logAudit(s.userId, "auth.mfa_enrolled", "auth", null, {});
  redirect("/dashboard");
}

/** Verifikasi kode TOTP saat login. */
export async function verifyMfaAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  "use server";
  const s = await getPreMfaSession();
  if (!s || !s.mfaEnrolled) return { ok: false, error: "Sesi tidak valid." };
  const code = String(form.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Kode harus 6 digit." };
  }
  const svc = getServiceClient();
  const { data: row } = await svc
    .from("admin_mfa")
    .select("secret_encrypted, enabled")
    .eq("user_id", s.userId)
    .maybeSingle();
  if (!row || row.enabled === false) {
    return { ok: false, error: "MFA belum diaktifkan." };
  }
  let secret: string;
  try {
    secret = decryptSecret(row.secret_encrypted);
  } catch {
    return { ok: false, error: "Konfigurasi MFA rusak. Hubungi super admin." };
  }
  const valid = totp.verify({ token: code, secret });
  if (!valid) {
    await logAudit(s.userId, "auth.mfa_failed", "auth", null, {});
    return { ok: false, error: "Kode salah. Coba lagi." };
  }
  const store = await cookies();
  const { value, maxAge } = signMfaCookie(s.userId);
  store.set(MFA_COOKIE, value, cookieOpts(maxAge));
  await logAudit(s.userId, "auth.mfa_ok", "auth", null, {});
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  "use server";
  const s = await getPreMfaSession();
  try {
    const supabase = await getSessionClient();
    await supabase.auth.signOut();
  } catch {
    /* abaikan */
  }
  const store = await cookies();
  store.delete(MFA_COOKIE);
  store.delete(ENROLL_COOKIE);
  for (const c of store.getAll()) {
    if (/^sb-.*-auth-token/.test(c.name)) store.delete(c.name);
  }
  if (s) await logAudit(s.userId, "auth.logout", "auth", null, {});
  redirect("/login");
}

/* ------------------------------ Pengguna ------------------------------ */

export async function suspendUserAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("users:suspend");
  const userId = need(form.get("user_id"), 10);
  const reason = need(form.get("reason"), 5);
  const suspend = form.get("suspend") === "1";
  if (!userId || !reason)
    return { ok: false, error: "User dan alasan (min 5 karakter) wajib diisi." };
  if (userId === staff.userId)
    return { ok: false, error: "Tidak dapat menangguhkan akun sendiri." };

  const svc = getServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ account_status: suspend ? "SUSPENDED" : "ACTIVE" })
    .eq("id", userId);
  if (error) return { ok: false, error: "Gagal memperbarui status akun." };
  await logAudit(
    staff.userId,
    suspend ? "user.suspend" : "user.unsuspend",
    "profiles",
    userId,
    { reason }
  );
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  return { ok: true };
}

/* ------------------------------ Kreator ------------------------------- */

export async function approveCreatorAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("verifications:write");
  const userId = need(form.get("user_id"), 10);
  if (!userId) return { ok: false, error: "User tidak valid." };

  const svc = getServiceClient();
  const { data: p } = await svc
    .from("profiles")
    .select("role, age_verified, verification_status, creator_status")
    .eq("id", userId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Profil tidak ditemukan." };
  // JANGAN aktifkan yang tidak memenuhi syarat — sesuai addendum.
  if (p.role !== "FEMALE" || p.age_verified !== true) {
    return {
      ok: false,
      error: "Ditolak sistem: kreator harus perempuan dan terverifikasi 18+.",
    };
  }
  const { error } = await svc
    .from("profiles")
    .update({ verification_status: "VERIFIED", creator_status: "ACTIVE" })
    .eq("id", userId);
  if (error) return { ok: false, error: "Gagal menyetujui kreator." };
  await svc.from("verification_records").insert({
    user_id: userId,
    provider: "MANUAL_REVIEW",
    verification_type: "IDENTITY_FACE",
    status: "APPROVED",
    reviewed_by: staff.userId,
    reviewed_at: new Date().toISOString(),
  });
  await logAudit(staff.userId, "creator.approve", "profiles", userId, {});
  revalidatePath("/verifications");
  revalidatePath("/creators");
  return { ok: true };
}

export async function rejectCreatorAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("verifications:write");
  const userId = need(form.get("user_id"), 10);
  const reason = need(form.get("reason"), 5);
  if (!userId || !reason)
    return { ok: false, error: "Alasan penolakan (min 5 karakter) wajib diisi." };

  const svc = getServiceClient();
  const { error } = await svc
    .from("profiles")
    .update({ verification_status: "REJECTED", creator_status: "INACTIVE" })
    .eq("id", userId);
  if (error) return { ok: false, error: "Gagal menolak kreator." };
  await svc.from("verification_records").insert({
    user_id: userId,
    provider: "MANUAL_REVIEW",
    verification_type: "IDENTITY_FACE",
    status: "REJECTED",
    provider_reference: reason,
    reviewed_by: staff.userId,
    reviewed_at: new Date().toISOString(),
  });
  await logAudit(staff.userId, "creator.reject", "profiles", userId, { reason });
  revalidatePath("/verifications");
  revalidatePath("/creators");
  return { ok: true };
}

export async function setCreatorStatusAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("creators:write");
  const userId = need(form.get("user_id"), 10);
  const status = need(form.get("status"), 3);
  const reason = need(form.get("reason"), 5);
  if (!userId || !status || !reason)
    return { ok: false, error: "Data tidak lengkap (alasan min 5 karakter)." };
  if (!["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status))
    return { ok: false, error: "Status tidak valid." };

  const svc = getServiceClient();
  if (status === "ACTIVE") {
    const { data: p } = await svc
      .from("profiles")
      .select("verification_status")
      .eq("id", userId)
      .maybeSingle();
    if (p?.verification_status !== "VERIFIED")
      return {
        ok: false,
        error: "Hanya kreator VERIFIED yang bisa diaktifkan.",
      };
  }
  const { error } = await svc
    .from("profiles")
    .update({ creator_status: status })
    .eq("id", userId);
  if (error) return { ok: false, error: "Gagal mengubah status kreator." };
  await logAudit(staff.userId, "creator.status", "profiles", userId, {
    status,
    reason,
  });
  revalidatePath("/creators");
  return { ok: true };
}

/* ----------------------------- Penghasilan ------------------------------ */

export async function releaseEarningAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("earnings:write");
  const earningId = need(form.get("earning_id"), 10);
  if (!earningId) return { ok: false, error: "Earning tidak valid." };

  const svc = getServiceClient();
  const { data: e } = await svc
    .from("creator_earnings")
    .select("id, status, creator_id, net_tokens")
    .eq("id", earningId)
    .maybeSingle();
  if (!e) return { ok: false, error: "Data tidak ditemukan." };
  if (e.status !== "PENDING")
    return { ok: false, error: "Hanya PENDING yang bisa dirilis." };
  const { error } = await svc
    .from("creator_earnings")
    .update({ status: "AVAILABLE", available_at: new Date().toISOString() })
    .eq("id", earningId);
  if (error) return { ok: false, error: "Gagal merilis penghasilan." };
  await logAudit(staff.userId, "earning.release", "creator_earnings", earningId, {
    creator_id: e.creator_id,
    net_tokens: e.net_tokens,
  });
  revalidatePath("/earnings");
  return { ok: true };
}

/* ----------------------------- Penarikan -------------------------------- */

export async function withdrawalAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("withdrawals:write");
  const id = need(form.get("withdrawal_id"), 10);
  const action = need(form.get("action"), 3);
  if (!id || !action) return { ok: false, error: "Data tidak lengkap." };

  const svc = getServiceClient();
  const { data: w } = await svc
    .from("withdrawals")
    .select("id, status, creator_id, amount_tokens")
    .eq("id", id)
    .maybeSingle();
  if (!w) return { ok: false, error: "Penarikan tidak ditemukan." };

  let patch: Record<string, unknown> = {};
  if (action === "approve") {
    if (w.status !== "REQUESTED")
      return { ok: false, error: "Hanya REQUESTED yang bisa disetujui." };
    patch = { status: "PROCESSING" };
  } else if (action === "reject") {
    const reason = need(form.get("failure_reason"), 5);
    if (!reason)
      return { ok: false, error: "Alasan penolakan wajib diisi." };
    if (w.status !== "REQUESTED")
      return { ok: false, error: "Hanya REQUESTED yang bisa ditolak." };
    patch = {
      status: "REJECTED",
      failure_reason: reason,
      processed_at: new Date().toISOString(),
    };
    // Kembalikan earning ke AVAILABLE
    await svc
      .from("creator_earnings")
      .update({ status: "AVAILABLE" })
      .eq("creator_id", w.creator_id)
      .eq("status", "WITHDRAWAL_REQUESTED");
  } else if (action === "mark_paid") {
    // PAID hanya setelah pembayaran BENAR-BENAR terkonfirmasi.
    const ref = need(form.get("payment_reference"), 3);
    if (!ref)
      return {
        ok: false,
        error: "Referensi pembayaran wajib diisi (bukti transfer nyata).",
      };
    if (w.status !== "PROCESSING")
      return { ok: false, error: "Hanya PROCESSING yang bisa ditandai PAID." };
    patch = {
      status: "PAID",
      payment_reference: ref,
      processed_at: new Date().toISOString(),
    };
    await svc
      .from("creator_earnings")
      .update({ status: "PAID" })
      .eq("creator_id", w.creator_id)
      .eq("status", "WITHDRAWAL_REQUESTED");
  } else {
    return { ok: false, error: "Aksi tidak dikenal." };
  }

  const { error } = await svc.from("withdrawals").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Gagal memproses penarikan." };
  await logAudit(staff.userId, `withdrawal.${action}`, "withdrawals", id, {
    creator_id: w.creator_id,
    amount_tokens: w.amount_tokens,
    payment_reference: patch.payment_reference ?? null,
  });
  revalidatePath("/withdrawals");
  revalidatePath("/earnings");
  return { ok: true };
}

/* --------------------- Koreksi token (kompensasi) ------------------------ */

export async function adjustWalletAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("transactions:write");
  const userId = need(form.get("user_id"), 10);
  const delta = Number(form.get("delta"));
  const reason = need(form.get("reason"), 5);
  if (!userId || !Number.isInteger(delta) || delta === 0 || !reason)
    return {
      ok: false,
      error: "User, delta (±, bukan nol), dan alasan wajib diisi.",
    };

  const svc = getServiceClient();
  const { data, error } = await svc.rpc("admin_adjust_tokens", {
    p_user_id: userId,
    p_delta: delta,
    p_reason: reason,
    p_actor_id: staff.userId,
  });
  if (error) return { ok: false, error: `Gagal: ${error.message}` };
  // admin_adjust_tokens sudah mencatat audit log sendiri di DB.
  revalidatePath("/transactions");
  return { ok: true, error: undefined };
}

/* ------------------------------- Laporan -------------------------------- */

export async function reportAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("reports:write");
  const id = need(form.get("report_id"), 10);
  const status = need(form.get("status"), 3);
  const note = String(form.get("note") ?? "").trim() || null;
  if (!id || !["reviewed", "actioned", "dismissed"].includes(status ?? ""))
    return { ok: false, error: "Data tidak valid." };

  const svc = getServiceClient();
  const { error } = await svc
    .from("reports")
    .update({ status, note })
    .eq("id", id);
  if (error) return { ok: false, error: "Gagal memperbarui laporan." };
  await logAudit(staff.userId, `report.${status}`, "reports", id, { note });
  revalidatePath("/reports");
  revalidatePath("/moderation");
  return { ok: true };
}

/* --------------------------- Konfigurasi -------------------------------- */

export async function updateBillingConfigAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("settings:write");
  const key = need(form.get("key"), 2);
  const value = String(form.get("value") ?? "").trim();
  if (!key || !value) return { ok: false, error: "Key dan value wajib diisi." };

  const svc = getServiceClient();
  const { data: before } = await svc
    .from("billing_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const { error } = await svc
    .from("billing_config")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Gagal menyimpan konfigurasi." };
  await logAudit(staff.userId, "config.update", "billing_config", key, {
    before: before?.value ?? null,
    after: value,
  });
  revalidatePath("/settings");
  return { ok: true };
}

/* ---------------------------- Akses & role ------------------------------- */

export async function setAdminRoleAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("access:write");
  const userId = need(form.get("user_id"), 10);
  const role = need(form.get("role"), 3);
  if (!userId || !role)
    return { ok: false, error: "User dan role wajib diisi." };
  if (
    !["SUPER_ADMIN", "ADMIN", "MODERATOR", "FINANCE", "SUPPORT"].includes(role)
  )
    return { ok: false, error: "Role tidak valid." };

  const svc = getServiceClient();
  const { error } = await svc.from("admin_roles").upsert({
    user_id: userId,
    role,
    created_by: staff.userId,
  });
  if (error) return { ok: false, error: "Gagal menyimpan role." };
  await logAudit(staff.userId, "access.grant", "admin_roles", userId, { role });
  revalidatePath("/access-control");
  return { ok: true };
}

export async function removeAdminRoleAction(
  _prev: ActionResult,
  form: FormData
): Promise<ActionResult> {
  const staff = await requirePermission("access:write");
  const userId = need(form.get("user_id"), 10);
  if (!userId) return { ok: false, error: "User tidak valid." };
  if (userId === staff.userId)
    return { ok: false, error: "Tidak dapat mencabut role sendiri." };

  const svc = getServiceClient();
  const { error } = await svc.from("admin_roles").delete().eq("user_id", userId);
  if (error) return { ok: false, error: "Gagal mencabut role." };
  await logAudit(staff.userId, "access.revoke", "admin_roles", userId, {});
  revalidatePath("/access-control");
  return { ok: true };
}
