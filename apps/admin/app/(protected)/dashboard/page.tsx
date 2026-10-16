import { requireStaff } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Kpi, Card, fmtNum } from "@/lib/ui";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

function dayKey(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

export default async function DashboardPage() {
  const staff = await requireStaff();
  const svc = getServiceClient();
  const since24h = new Date(Date.now() - DAY).toISOString();
  const since7d = new Date(Date.now() - 7 * DAY).toISOString();
  const updatedAt = new Date().toLocaleString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const [
    usersRes,
    creatorsRes,
    pendingRes,
    calls24Res,
    ledgerRes,
    earningsRes,
    feeRes,
    withdrawalsRes,
    reportsRes,
    users7dRes,
    calls7dRes,
  ] = await Promise.all([
    svc.from("profiles").select("id", { count: "exact", head: true }),
    svc
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "FEMALE")
      .eq("verification_status", "VERIFIED")
      .eq("creator_status", "ACTIVE")
      .eq("account_status", "ACTIVE"),
    svc
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("verification_status", "PENDING_REVIEW"),
    svc
      .from("calls")
      .select("id, status")
      .gte("requested_at", since24h)
      .limit(5000),
    svc
      .from("token_ledger")
      .select("amount")
      .eq("transaction_type", "CALL_DEBIT")
      .gte("created_at", since24h)
      .limit(10000),
    svc
      .from("creator_earnings")
      .select("platform_fee_tokens")
      .gte("created_at", since24h)
      .limit(10000),
    svc.from("billing_config").select("value").eq("key", "platform_fee_pct").maybeSingle(),
    svc
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("status", "REQUESTED"),
    svc
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    svc.from("profiles").select("created_at").gte("created_at", since7d).limit(20000),
    svc.from("calls").select("requested_at").gte("requested_at", since7d).limit(20000),
  ]);

  const calls24 = (calls24Res.data ?? []) as { status: string }[];
  const callsEnded = calls24.filter((c) => c.status === "ENDED").length;
  const callsFailed = calls24.filter((c) =>
    ["DECLINED", "EXPIRED", "CANCELLED"].includes(c.status)
  ).length;
  const tokensUsed = ((ledgerRes.data ?? []) as { amount: number }[]).reduce(
    (a, r) => a + Math.abs(r.amount),
    0
  );
  const feeEarned = ((earningsRes.data ?? []) as { platform_fee_tokens: number }[]).reduce(
    (a, r) => a + (r.platform_fee_tokens ?? 0),
    0
  );
  const feePct = feeRes.data?.value ?? "?";

  // Bucket 7 hari untuk grafik batang CSS murni (agregasi di server).
  const buckets: { label: string; users: number; calls: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    buckets.push({ label: dayKey(d), users: 0, calls: 0 });
  }
  for (const r of ((users7dRes.data ?? []) as { created_at: string }[])) {
    const b = buckets.find((x) => x.label === dayKey(new Date(r.created_at)));
    if (b) b.users += 1;
  }
  for (const r of ((calls7dRes.data ?? []) as { requested_at: string }[])) {
    const b = buckets.find((x) => x.label === dayKey(new Date(r.requested_at)));
    if (b) b.calls += 1;
  }
  const maxBar = Math.max(1, ...buckets.map((b) => Math.max(b.users, b.calls)));

  const showFin = can(staff.role, "transactions:read");
  const showUsers = can(staff.role, "users:read");
  const showMod = can(staff.role, "reports:read");

  return (
    <div>
      <PageTitle
        title="Ringkasan Operasional"
        sub={`Diperbarui ${updatedAt} WIB · semua angka dari database aktual`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {showUsers && (
          <>
            <Kpi
              label="Total pengguna"
              value={fmtNum(usersRes.count ?? 0)}
              sub="Akun terdaftar · sepanjang waktu"
              href="/users"
            />
            <Kpi
              label="Kreator aktif"
              value={fmtNum(creatorsRes.count ?? 0)}
              sub="FEMALE · VERIFIED · ACTIVE"
              href="/creators"
            />
            <Kpi
              label="Antre verifikasi"
              value={fmtNum(pendingRes.count ?? 0)}
              sub="PENDING_REVIEW · butuh tinjauan"
              href="/verifications"
            />
          </>
        )}
        <Kpi
          label="Panggilan 24 jam"
          value={fmtNum(calls24.length)}
          sub={`Berhasil ${callsEnded} · gagal ${callsFailed}`}
          href="/calls"
        />
        {showFin && (
          <>
            <Kpi
              label="Token terpakai 24 jam"
              value={fmtNum(tokensUsed)}
              sub="CALL_DEBIT · 24 jam terakhir"
              href="/transactions"
            />
            <Kpi
              label="Fee platform 24 jam"
              value={fmtNum(feeEarned)}
              sub={`Token · fee saat ini ${feePct}%`}
              href="/earnings"
            />
            <Kpi
              label="Penarikan menunggu"
              value={fmtNum(withdrawalsRes.count ?? 0)}
              sub="Status REQUESTED"
              href="/withdrawals"
            />
          </>
        )}
        {showMod && (
          <Kpi
            label="Laporan terbuka"
            value={fmtNum(reportsRes.count ?? 0)}
            sub="Status open · belum ditangani"
            href="/reports"
          />
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Pengguna baru · 7 hari" sub="Agregasi harian dari profiles.created_at">
          <Bars buckets={buckets} field="users" max={maxBar} />
        </Card>
        <Card title="Panggilan · 7 hari" sub="Agregasi harian dari calls.requested_at">
          <Bars buckets={buckets} field="calls" max={maxBar} />
        </Card>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        Definisi metrik: “berhasil” = panggilan berstatus ENDED; “gagal” =
        DECLINED/EXPIRED/CANCELLED. Token terpakai = jumlah absolut CALL_DEBIT.
        Tidak ada angka dummy di halaman ini.
      </p>
    </div>
  );
}

function Bars({
  buckets,
  field,
  max,
}: {
  buckets: { label: string; users: number; calls: number }[];
  field: "users" | "calls";
  max: number;
}) {
  if (buckets.every((b) => b[field] === 0)) {
    return (
      <p className="py-8 text-center text-sm text-ink-soft">
        Belum ada data pada periode ini.
      </p>
    );
  }
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label={`Grafik ${field} 7 hari`}>
      {buckets.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-[11px] font-bold tabular-nums text-ink-soft">
            {b[field] > 0 ? b[field] : ""}
          </span>
          <div
            className="w-full rounded-t-md bg-accent/70"
            style={{ height: `${Math.max(4, (b[field] / max) * 100)}%` }}
          />
          <span className="text-[10px] text-ink-soft">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
