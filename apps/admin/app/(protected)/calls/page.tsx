import { requirePermission } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate, fmtNum } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SP = { status?: string; q?: string };

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requirePermission("calls:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("calls")
    .select(
      "id, male_user_id, female_creator_id, status, requested_at, connected_at, ended_at, billable_duration_seconds, end_reason"
    )
    .order("requested_at", { ascending: false })
    .limit(50);
  if (sp.status) query = query.eq("status", sp.status);
  if (sp.q) query = query.ilike("id", `%${sp.q}%`);

  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    male_user_id: string;
    female_creator_id: string;
    status: string;
    requested_at: string;
    connected_at: string | null;
    ended_at: string | null;
    billable_duration_seconds: number;
    end_reason: string | null;
  }[];

  const ids = [...new Set(rows.flatMap((r) => [r.male_user_id, r.female_creator_id]))];
  const { data: profs } = ids.length
    ? await svc.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] };
  const names = new Map(
    ((profs ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name ?? "—"])
  );

  const { data: bills } = rows.length
    ? await svc
        .from("call_billing")
        .select("call_id, tokens_charged")
        .in("call_id", rows.map((r) => r.id))
    : { data: [] };
  const billed = new Map<string, number>();
  for (const b of ((bills ?? []) as { call_id: string; tokens_charged: number }[])) {
    billed.set(b.call_id, (billed.get(b.call_id) ?? 0) + (b.tokens_charged ?? 0));
  }

  return (
    <div>
      <PageTitle
        title="Panggilan"
        sub="Metadata sesi saja — admin TIDAK dapat melihat isi video/audio atau bergabung diam-diam."
      />

      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Cari Call ID…"
          className="min-w-44 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-ink-soft/50 focus:border-accent"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Semua status</option>
          {["REQUESTED", "ACCEPTED", "DECLINED", "ENDED", "EXPIRED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white">
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Tidak ada panggilan" text="Belum ada sesi panggilan yang cocok dengan filter." />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-ink-soft">{c.id}</p>
                  <p className="mt-1 text-sm font-bold">
                    {names.get(c.male_user_id)} <span className="text-ink-soft">→</span>{" "}
                    {names.get(c.female_creator_id)}
                  </p>
                </div>
                <Badge tone={statusTone(c.status)}>{c.status}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-xs text-ink-soft sm:grid-cols-4">
                <span>Diminta: {fmtDate(c.requested_at)}</span>
                <span>Terhubung: {fmtDate(c.connected_at)}</span>
                <span>Berakhir: {fmtDate(c.ended_at)}</span>
                <span>
                  Durasi tagih: <span className="font-bold text-ink tabular-nums">{fmtNum(c.billable_duration_seconds)} dtk</span>
                  {" · "}
                  <span className="font-bold text-ink tabular-nums">{fmtNum(billed.get(c.id) ?? 0)}</span> token
                </span>
              </div>
              {c.end_reason && (
                <p className="mt-2 text-xs text-ink-soft">Alasan berakhir: {c.end_reason}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
