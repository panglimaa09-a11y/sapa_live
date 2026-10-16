import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  role?: string;
  status?: string;
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await requirePermission("users:read");
  const sp = await searchParams;
  const svc = getServiceClient();

  let query = svc
    .from("profiles")
    .select(
      "id, display_name, role, verification_status, creator_status, account_status, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (sp.q) query = query.ilike("display_name", `%${sp.q}%`);
  if (sp.role === "MALE" || sp.role === "FEMALE") query = query.eq("role", sp.role);
  if (sp.status) query = query.eq("account_status", sp.status);

  const { data } = await query;
  const rows = (data ?? []) as {
    id: string;
    display_name: string | null;
    role: string;
    verification_status: string;
    creator_status: string;
    account_status: string;
    created_at: string;
  }[];

  return (
    <div>
      <PageTitle
        title="Pengguna"
        sub="Maksimal 50 baris terbaru. Semua perubahan status tercatat di audit log."
      />

      <form method="get" className="mb-5 flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Cari nama tampilan…"
          className="min-w-52 flex-1 rounded-xl border border-white/10 bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-ink-soft/50 focus:border-accent"
        />
        <select
          name="role"
          defaultValue={sp.role ?? ""}
          className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Semua role</option>
          <option value="MALE">MALE</option>
          <option value="FEMALE">FEMALE</option>
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-sm"
        >
          <option value="">Semua status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="BANNED">BANNED</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white"
        >
          Filter
        </button>
      </form>

      {rows.length === 0 ? (
        <Empty
          title="Tidak ada pengguna"
          text="Tidak ada akun yang cocok dengan filter. Data diambil langsung dari tabel profiles."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-ink-soft">
                  <th className="py-3 pr-4 font-bold">Nama</th>
                  <th className="py-3 pr-4 font-bold">Role</th>
                  <th className="py-3 pr-4 font-bold">Verifikasi</th>
                  <th className="py-3 pr-4 font-bold">Kreator</th>
                  <th className="py-3 pr-4 font-bold">Akun</th>
                  <th className="py-3 pr-4 font-bold">Terdaftar</th>
                  <th className="py-3 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="py-3 pr-4 font-bold">{r.display_name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={r.role === "FEMALE" ? "blue" : "gray"}>{r.role}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={statusTone(r.verification_status)}>
                        {r.verification_status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={statusTone(r.creator_status)}>{r.creator_status}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={statusTone(r.account_status)}>{r.account_status}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">{fmtDate(r.created_at)}</td>
                    <td className="py-3">
                      <Link
                        href={`/users/${r.id}`}
                        className="font-bold text-accent hover:underline"
                      >
                        Detail
                      </Link>
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
