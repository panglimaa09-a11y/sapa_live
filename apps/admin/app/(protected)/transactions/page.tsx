import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { adjustWalletAction } from "@/lib/actions";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate, fmtNum } from "@/lib/ui";
import { AdjustForm } from "./adjust-form";

export const dynamic = "force-dynamic";

type SP = { type?: string; q?: string };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const staff = await requirePermission("transactions:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("token_ledger")
    .select("id, user_id, transaction_type, amount, balance_after, reference_type, reference_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (sp.type) query = query.eq("transaction_type", sp.type);
  if (sp.q) query = query.eq("user_id", sp.q);

  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    user_id: string;
    transaction_type: string;
    amount: number;
    balance_after: number;
    reference_type: string | null;
    reference_id: string | null;
    created_at: string;
  }[];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: profs } = ids.length
    ? await svc.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const names = new Map(
    ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name ?? p.id.slice(0, 8)])
  );

  const canAdjust = can(staff.role, "transactions:write");

  return (
    <div>
      <PageTitle
        title="Transaksi Token"
        sub="Ledger append-only. Koreksi HANYA via transaksi kompensasi ADMIN_ADJUST — tidak ada edit diam-diam."
        action={canAdjust ? <AdjustForm /> : undefined}
      />

      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Semua tipe</option>
          {["TOPUP", "CALL_DEBIT", "CALL_REFUND", "ADMIN_ADJUST"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Filter user_id (UUID)…"
          className="min-w-44 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-2.5 font-mono text-sm outline-none placeholder:text-ink-soft/50 focus:border-accent"
        />
        <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Tidak ada transaksi" text="Ledger kosong untuk filter ini." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-3 pr-4 font-bold">Waktu</th>
                  <th className="py-3 pr-4 font-bold">Pengguna</th>
                  <th className="py-3 pr-4 font-bold">Tipe</th>
                  <th className="py-3 pr-4 font-bold">Jumlah</th>
                  <th className="py-3 pr-4 font-bold">Saldo sesudah</th>
                  <th className="py-3 font-bold">Referensi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 text-xs text-ink-soft">{fmtDate(r.created_at)}</td>
                    <td className="py-3 pr-4 font-bold">{names.get(r.user_id) ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={statusTone(r.transaction_type === "CALL_DEBIT" ? "FAILED" : r.transaction_type === "TOPUP" ? "APPROVED" : "gray")}>
                        {r.transaction_type}
                      </Badge>
                    </td>
                    <td className={`py-3 pr-4 font-extrabold tabular-nums ${r.amount < 0 ? "text-red-300" : "text-accent2"}`}>
                      {r.amount > 0 ? "+" : ""}{fmtNum(r.amount)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{fmtNum(r.balance_after)}</td>
                    <td className="py-3 font-mono text-xs text-ink-soft">
                      {r.reference_type ?? "—"}{r.reference_id ? ` · ${r.reference_id.slice(0, 12)}` : ""}
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
