import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { setCreatorStatusAction } from "@/lib/actions";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate, fmtNum } from "@/lib/ui";
import { CreatorStatusForm } from "./status-form";

export const dynamic = "force-dynamic";

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await requirePermission("creators:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("profiles")
    .select("id, display_name, verification_status, creator_status, account_status, is_available, created_at")
    .eq("role", "FEMALE")
    .order("created_at", { ascending: false })
    .limit(100);
  if (sp.status) query = query.eq("creator_status", sp.status);
  const { data: profiles } = await query;
  const rows = (profiles ?? []) as {
    id: string;
    display_name: string | null;
    verification_status: string;
    creator_status: string;
    account_status: string;
    is_available: boolean;
    created_at: string;
  }[];

  const ids = rows.map((r) => r.id);
  const { data: cps } = ids.length
    ? await svc.from("creator_profiles").select("user_id, rate_tokens_per_interval").in("user_id", ids)
    : { data: [] };
  const rate = new Map(((cps ?? []) as { user_id: string; rate_tokens_per_interval: number }[]).map((c) => [c.user_id, c.rate_tokens_per_interval]));

  const { data: earnRows } = ids.length
    ? await svc.from("creator_earnings").select("creator_id, net_tokens, status").in("creator_id", ids)
    : { data: [] };
  const earnings = new Map<string, { total: number; available: number }>();
  for (const e of ((earnRows ?? []) as { creator_id: string; net_tokens: number; status: string }[])) {
    const cur = earnings.get(e.creator_id) ?? { total: 0, available: 0 };
    cur.total += e.net_tokens ?? 0;
    if (e.status === "AVAILABLE") cur.available += e.net_tokens ?? 0;
    earnings.set(e.creator_id, cur);
  }

  const canWrite = can(staff.role, "creators:write");

  return (
    <div>
      <PageTitle
        title="Kreator Perempuan"
        sub="Syarat aktif: 18+, VERIFIED, creator ACTIVE, akun ACTIVE. Data dari profiles + creator_earnings."
      />

      <form method="get" className="mb-5 flex gap-2">
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Semua status kreator</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PENDING">PENDING</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
        <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Tidak ada kreator" text="Belum ada akun kreator yang cocok dengan filter." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const e = earnings.get(r.id);
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-lg font-extrabold text-accent">
                      {(r.display_name ?? "?").charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-extrabold">{r.display_name ?? "—"}</p>
                      <p className="text-xs text-ink-soft">
                        Tarif {rate.get(r.id) ?? 3} token/30 dtk · tersedia: {r.is_available ? "ya" : "tidak"} · {fmtDate(r.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(r.verification_status)}>{r.verification_status}</Badge>
                    <Badge tone={statusTone(r.creator_status)}>{r.creator_status}</Badge>
                    <Badge tone={statusTone(r.account_status)}>{r.account_status}</Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                  <p className="text-sm text-ink-soft">
                    Penghasilan: <span className="font-extrabold text-ink tabular-nums">{fmtNum(e?.total ?? 0)}</span> token
                    {" · "}available: <span className="font-extrabold text-accent2 tabular-nums">{fmtNum(e?.available ?? 0)}</span>
                  </p>
                  {canWrite && <CreatorStatusForm userId={r.id} current={r.creator_status} />}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
