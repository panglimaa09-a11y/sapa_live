import { notFound } from "next/navigation";
import { requirePermission, maskEmail } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import {
  PageTitle,
  Badge,
  Card,
  statusTone,
  fmtDate,
  fmtNum,
} from "@/lib/ui";
import { SuspendForm } from "./suspend-form";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requirePermission("users:read");
  const { id } = await params;
  const svc = getServiceClient();

  const { data: p } = await svc.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();

  const isSuper = staff.role === "SUPER_ADMIN";
  let email = "—";
  try {
    const { data } = await svc.auth.admin.getUserById(id);
    email = maskEmail(data.user?.email ?? "", isSuper);
  } catch {
    email = "—";
  }

  const showWallet = can(staff.role, "transactions:read");
  const [{ data: wallet }, { data: calls }, { data: ledger }] = await Promise.all([
    showWallet
      ? svc.from("wallets").select("tokens").eq("user_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    svc
      .from("calls")
      .select("id, status, requested_at, billable_duration_seconds")
      .or(`male_user_id.eq.${id},female_creator_id.eq.${id}`)
      .order("requested_at", { ascending: false })
      .limit(10),
    showWallet
      ? svc
          .from("token_ledger")
          .select("transaction_type, amount, created_at")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const canSuspend = can(staff.role, "users:suspend");
  const suspended = p.account_status !== "ACTIVE";

  return (
    <div>
      <PageTitle title={p.display_name ?? "Pengguna"} sub={`ID: ${id}`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profil akun">
          <dl className="space-y-2.5 text-sm">
            <Row k="Email" v={email} />
            <Row k="Role" v={p.role} />
            <Row
              k="Verifikasi"
              v={<Badge tone={statusTone(p.verification_status)}>{p.verification_status}</Badge>}
            />
            <Row
              k="Status kreator"
              v={<Badge tone={statusTone(p.creator_status)}>{p.creator_status}</Badge>}
            />
            <Row
              k="Status akun"
              v={<Badge tone={statusTone(p.account_status)}>{p.account_status}</Badge>}
            />
            <Row k="Tersedia (kreator)" v={p.is_available ? "Ya" : "Tidak"} />
            <Row k="Terdaftar" v={fmtDate(p.created_at)} />
          </dl>
        </Card>

        <div className="space-y-4">
          {showWallet && (
            <Card title="Dompet token">
              <p className="text-3xl font-extrabold tabular-nums">
                {fmtNum((wallet as { tokens: number } | null)?.tokens ?? 0)}
              </p>
              <p className="mt-1 text-xs text-ink-soft">Saldo token aktual</p>
            </Card>
          )}

          {canSuspend && (
            <Card
              title={suspended ? "Aktifkan kembali" : "Tangguhkan akun"}
              sub="Alasan wajib diisi dan tercatat di audit log."
            >
              <SuspendForm userId={id} suspended={suspended} />
            </Card>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Panggilan terakhir" sub="10 terbaru · metadata saja">
          {((calls ?? []) as { id: string; status: string; requested_at: string; billable_duration_seconds: number }[]).length === 0 ? (
            <p className="text-sm text-ink-soft">Belum ada panggilan.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {((calls ?? []) as { id: string; status: string; requested_at: string; billable_duration_seconds: number }[]).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                  <span className="truncate font-mono text-xs text-ink-soft">{c.id.slice(0, 8)}…</span>
                  <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  <span className="text-xs text-ink-soft">{fmtDate(c.requested_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {showWallet && (
          <Card title="Transaksi token terakhir" sub="10 terbaru dari ledger">
            {((ledger ?? []) as { transaction_type: string; amount: number; created_at: string }[]).length === 0 ? (
              <p className="text-sm text-ink-soft">Belum ada transaksi.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {((ledger ?? []) as { transaction_type: string; amount: number; created_at: string }[]).map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3.5 py-2.5">
                    <span className="font-bold">{t.transaction_type}</span>
                    <span className={`font-extrabold tabular-nums ${t.amount < 0 ? "text-red-300" : "text-accent2"}`}>
                      {t.amount > 0 ? "+" : ""}{fmtNum(t.amount)}
                    </span>
                    <span className="text-xs text-ink-soft">{fmtDate(t.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="font-bold text-right">{v}</dd>
    </div>
  );
}
