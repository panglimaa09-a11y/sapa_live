// ============================================================================
// SERVER ONLY — audit log. Panggil di SETIAP mutasi admin.
// Jangan pernah mencatat password, token sesi, secret, atau dokumen identitas.
// ============================================================================
import "server-only";

import { getServiceClient } from "./supabase";

export async function logAudit(
  actorId: string | null,
  action: string,
  resourceType?: string | null,
  resourceId?: string | null,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    const svc = getServiceClient();
    await svc.from("admin_audit_logs").insert({
      actor_id: actorId,
      action,
      resource_type: resourceType ?? null,
      resource_id: resourceId ?? null,
      meta: meta ?? {},
    });
  } catch {
    // Audit tidak boleh menggagalkan aksi utama; kegagalan dicatat di server log.
    console.error(`[audit] gagal mencatat ${action}`);
  }
}
