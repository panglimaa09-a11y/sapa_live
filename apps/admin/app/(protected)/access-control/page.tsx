import { requirePermission, maskEmail } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { setAdminRoleAction, removeAdminRoleAction } from "@/lib/actions";
import { PageTitle, Badge, Empty, Card, fmtDate } from "@/lib/ui";
import { RoleForms } from "./forms";

export const dynamic = "force-dynamic";

const ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "FINANCE", "SUPPORT"] as const;

export default async function AccessControlPage() {
  const staff = await requirePermission("access:read");
  const svc = getServiceClient();

  const { data } = await svc
    .from("admin_roles")
    .select("user_id, role, created_at, created_by")
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as {
    user_id: string;
    role: string;
    created_at: string;
    created_by: string | null;
  }[];

  // Email via Admin API (satu per baris — panel admin, volume kecil).
  const emails = new Map<string, string>();
  await Promise.all(
    rows.map(async (r) => {
      try {
        const { data: u } = await svc.auth.admin.getUserById(r.user_id);
        emails.set(r.user_id, maskEmail(u.user?.email ?? "", true));
      } catch {
        emails.set(r.user_id, "—");
      }
    })
  );

  return (
    <div>
      <PageTitle
        title="Akses & Role"
        sub="Hanya SUPER_ADMIN. Pemberian/pencabutan role tercatat di audit log."
      />

      <Card
        title="Tambah / ubah role staf"
        sub="User harus sudah punya akun (login via Supabase Auth). Tidak ada registrasi admin publik."
      >
        <RoleForms roles={[...ROLES]} />
      </Card>

      <div className="mt-4">
        {rows.length === 0 ? (
          <Empty
            title="Belum ada staf"
            text="Provisioning admin pertama dilakukan via SQL manual (lihat README)."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.user_id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{emails.get(r.user_id) ?? "—"}</p>
                    <p className="mt-0.5 font-mono text-xs text-ink-soft">
                      {r.user_id} · sejak {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{r.role}</Badge>
                    {r.user_id !== staff.userId && (
                      <RoleForms roles={[...ROLES]} removeOnly userId={r.user_id} />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
