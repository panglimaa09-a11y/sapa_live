import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Badge, Empty, Card, fmtDate, fmtNum } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Pusat moderasi: ringkasan antrean + tindakan terakhir.
 * Keputusan per laporan tetap dilakukan di /reports.
 */
export default async function ModerationPage() {
  await requirePermission("reports:write");
  const svc = getServiceClient();

  const [{ count: openCount }, { data: recent }, { data: auditRows }] = await Promise.all([
    svc.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    svc
      .from("reports")
      .select("id, reported_user_id, reason, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10),
    svc
      .from("admin_audit_logs")
      .select("action, resource_id, created_at, meta")
      .in("action", ["user.suspend", "user.unsuspend", "creator.status", "report.actioned"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const rows = (recent ?? []) as {
    id: string;
    reported_user_id: string | null;
    reason: string;
    status: string;
    created_at: string;
  }[];
  const ids = [...new Set(rows.map((r) => r.reported_user_id).filter(Boolean) as string[])];
  const { data: profs } = ids.length
    ? await svc.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const names = new Map(
    ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name ?? "—"])
  );

  return (
    <div>
      <PageTitle
        title="Pusat Moderasi"
        sub="Keputusan moderasi manusia — bukan otomatis. Setiap tindakan tercatat."
        action={
          <Link href="/reports?status=open" className="rounded-full bg-accent px-6 py-2.5 text-sm font-extrabold text-white">
            Buka antrean ({fmtNum(openCount ?? 0)})
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Laporan terbuka terbaru" sub="10 terbaru · kelola di halaman Laporan">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Antrean kosong. Bagus.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-bold">{r.reported_user_id ? names.get(r.reported_user_id) : "—"}</span>
                    <span className="block truncate text-xs text-ink-soft">{r.reason}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-soft">{fmtDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Tindakan moderasi terakhir" sub="Dari audit log">
          {((auditRows ?? []) as { action: string; resource_id: string | null; created_at: string }[]).length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-soft">Belum ada tindakan tercatat.</p>
          ) : (
            <ul className="space-y-2">
              {((auditRows ?? []) as { action: string; resource_id: string | null; created_at: string }[]).map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3.5 py-2.5 text-sm">
                  <span>
                    <Badge tone="blue">{a.action}</Badge>
                  </span>
                  <span className="font-mono text-xs text-ink-soft">
                    {(a.resource_id ?? "—").slice(0, 12)} · {fmtDate(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Kebijakan" sub="Diingatkan di setiap sesi">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          <li>Jangan menghukum otomatis dari satu laporan yang belum ditinjau.</li>
          <li>Penangguhan butuh alasan tertulis (dicatat di audit log).</li>
          <li>Data identitas/biometrik tidak ditampilkan di panel ini.</li>
        </ul>
      </Card>
    </div>
  );
}
