import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { releaseEarningAction } from "@/lib/actions";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate, fmtNum } from "@/lib/ui";
import { ReleaseButton } from "./release-button";

export const dynamic = "force-dynamic";

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await requirePermission("earnings:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("creator_earnings")
    .select("id, creator_id, call_id, gross_tokens, platform_fee_tokens, net_tokens, status, created_at, available_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (sp.status) query = query.eq("status", sp.status);
  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    creator_id: string;
    call_id: string;
    gross_tokens: number;
    platform_fee_tokens: number;
    net_tokens: number;
    status: string;
    created_at: string;
    available_at: string | null;
  }[];

  const ids = [...new Set(rows.map((r) => r.creator_id))];
  const { data: profs } = ids.length
    ? await svc.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const names = new Map(
    ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name ?? "—"])
  );

  const totals = rows.reduce(
    (a, r) => ({ gross: a.gross + r.gross_tokens, fee: a.fee + r.platform_fee_tokens, net: a.net + r.net_tokens }),
    { gross: 0, fee: 0, net: 0 }
  );

  const canWrite = can(staff.role, "earnings:write");

  return (
    <div>
      <PageTitle
        title="Penghasilan Kreator"
        sub={`Total pada filter ini — kotor ${fmtNum(totals.gross)}, fee ${fmtNum(totals.fee)}, bersih ${fmtNum(totals.net)} token.`}
      />

      <form method="get" className="mb-5 flex gap-2">
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm">
          <option value="">Semua status</option>
          {["PENDING", "AVAILABLE", "WITHDRAWAL_REQUESTED", "PAID", "ON_HOLD", "REVERSED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Tidak ada data" text="Belum ada penghasilan kreator pada filter ini." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-3 pr-4 font-bold">Waktu</th>
                  <th className="py-3 pr-4 font-bold">Kreator</th>
                  <th className="py-3 pr-4 font-bold">Kotor</th>
                  <th className="py-3 pr-4 font-bold">Fee</th>
                  <th className="py-3 pr-4 font-bold">Bersih</th>
                  <th className="py-3 pr-4 font-bold">Status</th>
                  <th className="py-3 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 text-xs text-ink-soft">{fmtDate(r.created_at)}</td>
                    <td className="py-3 pr-4 font-bold">{names.get(r.creator_id) ?? "—"}</td>
                    <td className="py-3 pr-4 tabular-nums">{fmtNum(r.gross_tokens)}</td>
                    <td className="py-3 pr-4 tabular-nums text-ink-soft">{fmtNum(r.platform_fee_tokens)}</td>
                    <td className="py-3 pr-4 font-extrabold tabular-nums text-accent2">{fmtNum(r.net_tokens)}</td>
                    <td className="py-3 pr-4"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                    <td className="py-3">
                      {canWrite && r.status === "PENDING" ? (
                        <ReleaseButton earningId={r.id} />
                      ) : (
                        <span className="text-xs text-ink-soft">—</span>
                      )}
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
