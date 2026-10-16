import { requirePermission } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Empty, Card, fmtDate } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SP = { action?: string; q?: string };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requirePermission("audit:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("admin_audit_logs")
    .select("id, actor_id, action, resource_type, resource_id, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (sp.action) query = query.ilike("action", `%${sp.action}%`);
  if (sp.q) query = query.eq("actor_id", sp.q);

  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    actor_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    meta: Record<string, unknown>;
    created_at: string;
  }[];

  return (
    <div>
      <PageTitle
        title="Audit Log"
        sub="Rekaman aksi administratif. Append-only — tidak bisa diubah/dihapus dari panel."
      />

      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input
          name="action"
          defaultValue={sp.action ?? ""}
          placeholder="Filter aksi, cth: wallet.adjust"
          className="min-w-44 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-ink-soft/50 focus:border-accent"
        />
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Filter actor_id (UUID)"
          className="min-w-44 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-2.5 font-mono text-sm outline-none placeholder:text-ink-soft/50 focus:border-accent"
        />
        <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Tidak ada log" text="Belum ada aktivitas tercatat untuk filter ini." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-3 pr-4 font-bold">Waktu</th>
                  <th className="py-3 pr-4 font-bold">Aktor</th>
                  <th className="py-3 pr-4 font-bold">Aksi</th>
                  <th className="py-3 pr-4 font-bold">Resource</th>
                  <th className="py-3 font-bold">Meta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="whitespace-nowrap py-3 pr-4 text-xs text-ink-soft">{fmtDate(r.created_at)}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{r.actor_id?.slice(0, 8) ?? "—"}…</td>
                    <td className="py-3 pr-4 font-bold">{r.action}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-ink-soft">
                      {r.resource_type ?? "—"}
                      {r.resource_id ? ` · ${r.resource_id.slice(0, 12)}` : ""}
                    </td>
                    <td className="max-w-64 truncate py-3 font-mono text-xs text-ink-soft" title={JSON.stringify(r.meta)}>
                      {JSON.stringify(r.meta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
