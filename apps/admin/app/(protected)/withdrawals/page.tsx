import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate, fmtNum } from "@/lib/ui";
import { WithdrawalActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function WithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await requirePermission("withdrawals:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("withdrawals")
    .select("id, creator_id, amount_tokens, status, payment_reference, requested_at, processed_at, failure_reason")
    .order("requested_at", { ascending: false })
    .limit(50);
  if (sp.status) query = query.eq("status", sp.status);
  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    creator_id: string;
    amount_tokens: number;
    status: string;
    payment_reference: string | null;
    requested_at: string;
    processed_at: string | null;
    failure_reason: string | null;
  }[];

  const ids = [...new Set(rows.map((r) => r.creator_id))];
  const { data: profs } = ids.length
    ? await svc.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const names = new Map(
    ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name ?? "—"])
  );

  const canWrite = can(staff.role, "withdrawals:write");

  return (
    <div>
      <PageTitle
        title="Penarikan Dana"
        sub="Alur: REQUESTED → PROCESSING → PAID. Status PAID hanya setelah pembayaran benar-benar terkonfirmasi."
      />

      <form method="get" className="mb-5 flex gap-2">
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm">
          <option value="">Semua status</option>
          {["REQUESTED", "PROCESSING", "PAID", "FAILED", "REJECTED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Tidak ada penarikan" text="Belum ada permintaan penarikan pada filter ini." />
      ) : (
        <div className="space-y-3">
          {rows.map((w) => (
            <Card key={w.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold">
                    {names.get(w.creator_id) ?? "—"}{" "}
                    <span className="text-accent2 tabular-nums">{fmtNum(w.amount_tokens)} token</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Diajukan {fmtDate(w.requested_at)}
                    {w.processed_at ? ` · diproses ${fmtDate(w.processed_at)}` : ""}
                    {w.payment_reference ? ` · ref: ${w.payment_reference}` : ""}
                  </p>
                  {w.failure_reason && (
                    <p className="mt-1 text-xs text-red-300">Alasan: {w.failure_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={statusTone(w.status)}>{w.status}</Badge>
                  {canWrite && <WithdrawalActions id={w.id} status={w.status} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
