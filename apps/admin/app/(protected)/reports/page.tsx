import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate } from "@/lib/ui";
import { ReportActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await requirePermission("reports:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("reports")
    .select("id, reporter_id, reported_user_id, match_id, reason, note, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (sp.status) query = query.eq("status", sp.status);
  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    reporter_id: string | null;
    reported_user_id: string | null;
    match_id: string | null;
    reason: string;
    note: string | null;
    status: string;
    created_at: string;
  }[];

  const ids = [...new Set(rows.flatMap((r) => [r.reporter_id, r.reported_user_id]).filter(Boolean) as string[])];
  const { data: profs } = ids.length
    ? await svc.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const names = new Map(
    ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name ?? "—"])
  );

  const canWrite = can(staff.role, "reports:write");

  return (
    <div>
      <PageTitle
        title="Laporan Pengguna"
        sub="Antrean laporan dari pengguna. Jangan menghukum otomatis dari satu laporan yang belum ditinjau."
      />

      <form method="get" className="mb-5 flex gap-2">
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm">
          <option value="">Semua status</option>
          {["open", "reviewed", "actioned", "dismissed"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Tidak ada laporan" text="Antrean kosong untuk filter ini." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-extrabold">
                  Dilaporkan: {r.reported_user_id ? names.get(r.reported_user_id) ?? "—" : "—"}
                </p>
                <Badge tone={r.status === "open" ? "amber" : statusTone(r.status)}>{r.status}</Badge>
              </div>
              <p className="mt-2 text-sm">
                <span className="font-bold text-ink-soft">Alasan: </span>{r.reason}
              </p>
              {r.note && <p className="mt-1 text-sm text-ink-soft">{r.note}</p>}
              <p className="mt-1 text-xs text-ink-soft">
                Pelapor: {r.reporter_id ? names.get(r.reporter_id) ?? "—" : "—"} · {fmtDate(r.created_at)}
                {r.match_id ? ` · panggilan ${r.match_id.slice(0, 8)}…` : ""}
              </p>
              {canWrite && r.status === "open" && (
                <div className="mt-4 border-t border-white/5 pt-4">
                  <ReportActions reportId={r.id} reportedUserId={r.reported_user_id} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
