// ============================================================================
// SERVER ONLY — helper sesi autentikasi staf admin.
// Server ACTIONS (login, MFA, mutasi) tinggal di lib/actions.ts.
// ============================================================================
import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServiceClient, getSessionClient } from "./supabase";
import { verifyMfaCookie } from "./crypto";
import { can, type Permission, type Role } from "./permissions";

export type StaffSession = {
  userId: string;
  email: string;
  role: Role;
  mfaEnrolled: boolean;
};

export type ActionResult = { ok: boolean; error?: string };

const MFA_COOKIE = "admfa";

/** Sesi staf yang sudah lolos penuh (sesi + role + MFA bila enroll). */
export async function getStaffSession(): Promise<StaffSession | null> {
  try {
    const supabase = await getSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const svc = getServiceClient();
    const { data: roleRow } = await svc
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!roleRow?.role) return null;

    const { data: mfaRow } = await svc
      .from("admin_mfa")
      .select("enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    // MFA dinonaktifkan atas permintaan owner (16 Okt 2026): anggap tidak enroll.
    const mfaEnrolled = false;
    void mfaRow;

    return {
      userId: user.id,
      email: user.email ?? "",
      role: roleRow.role as Role,
      mfaEnrolled,
    };
  } catch {
    return null;
  }
}

/** Sesi pra-MFA: sesi + role valid, tanpa cek cookie MFA (untuk /mfa). */
export async function getPreMfaSession(): Promise<StaffSession | null> {
  try {
    const supabase = await getSessionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const svc = getServiceClient();
    const { data: roleRow } = await svc
      .from("admin_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!roleRow?.role) return null;
    const { data: mfaRow } = await svc
      .from("admin_mfa")
      .select("enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    return {
      userId: user.id,
      email: user.email ?? "",
      role: roleRow.role as Role,
      mfaEnrolled: !!mfaRow && mfaRow.enabled !== false,
    };
  } catch {
    return null;
  }
}

export async function requireStaff(): Promise<StaffSession> {
  const s = await getStaffSession();
  if (!s) redirect("/login");
  return s;
}

export async function requirePermission(perm: Permission): Promise<StaffSession> {
  const s = await requireStaff();
  if (!can(s.role, perm)) redirect("/dashboard");
  return s;
}

/** Samarkan email untuk role non-super-admin. */
export function maskEmail(email: string, isSuperAdmin: boolean): string {
  if (isSuperAdmin || !email) return email || "—";
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  const head = (local ?? "").slice(0, 2);
  return `${head}•••@${domain}`;
}
