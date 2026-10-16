import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Card, Empty } from "@/lib/ui";
import { ConfigForm } from "./config-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const staff = await requirePermission("settings:read");
  const svc = getServiceClient();
  const { data } = await svc.from("billing_config").select("key, value, updated_at").order("key");
  const rows = (data ?? []) as { key: string; value: string; updated_at: string }[];

  const canWrite = can(staff.role, "settings:write");

  return (
    <div>
      <PageTitle
        title="Konfigurasi Platform"
        sub="billing_config — dipakai backend penagihan. Perubahan tercatat di audit log."
      />

      <Card
        title="Peringatan"
        sub="Nilai tarif & komisi BELUM ditentukan Tuan. Jangan produksi sebelum diisi dan disetujui."
      >
        <p className="text-sm text-amber-300">
          Mengubah tarif tanpa pencatatan adalah pelanggaran kebijakan — setiap
          perubahan di sini otomatis tercatat (aktor, sebelum, sesudah).
        </p>
      </Card>

      <div className="mt-4">
        {rows.length === 0 ? (
          <Empty title="Konfigurasi kosong" text="Tabel billing_config belum punya baris. Jalankan migration_addendum.sql." />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.key}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-extrabold">{r.key}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      Nilai saat ini: <span className="font-bold text-ink">{r.value || "(kosong)"}</span>
                    </p>
                  </div>
                  {canWrite && <ConfigForm configKey={r.key} current={r.value} />}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {!canWrite && (
        <p className="mt-4 text-xs text-ink-soft">
          Role kamu hanya bisa membaca. Pengubahan butuh SUPER_ADMIN.
        </p>
      )}
    </div>
  );
}
