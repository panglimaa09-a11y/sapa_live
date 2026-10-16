import { requirePermission } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Card, Badge } from "@/lib/ui";

export const dynamic = "force-dynamic";

type Check = {
  name: string;
  desc: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  detail: string;
};

async function checkSupabase(): Promise<Check> {
  const base = {
    name: "Supabase / PostgreSQL",
    desc: "Kueri ringan select 1 via REST (mengukur latensi round-trip).",
  };
  try {
    const svc = getServiceClient();
    const t0 = Date.now();
    const { error } = await svc.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    const ms = Date.now() - t0;
    if (error) return { ...base, status: "down", detail: `Error: ${error.message}` };
    return {
      ...base,
      status: ms < 1500 ? "healthy" : "degraded",
      detail: `OK · latensi ${ms} ms`,
    };
  } catch (e) {
    return { ...base, status: "down", detail: `Gagal: ${(e as Error).message}` };
  }
}

async function checkPakasir(): Promise<Check> {
  const base = {
    name: "Pakasir (payment provider)",
    desc: "Reachability HTTPS saja — BUKAN validasi kredensial/API key.",
  };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const t0 = Date.now();
    const res = await fetch("https://app.pakasir.com", {
      method: "HEAD",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const ms = Date.now() - t0;
    return {
      ...base,
      status: res.ok ? "healthy" : "degraded",
      detail: `HTTP ${res.status} · ${ms} ms (hanya cek koneksi)`,
    };
  } catch {
    return { ...base, status: "down", detail: "Tidak dapat dijangkau (timeout/error)." };
  }
}

function staticCheck(name: string, desc: string, detail: string): Check {
  return { name, desc, status: "unknown", detail };
}

const tone = {
  healthy: "green",
  degraded: "amber",
  down: "red",
  unknown: "gray",
} as const;

const label = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
} as const;

export default async function SystemHealthPage() {
  await requirePermission("health:read");
  const checkedAt = new Date().toLocaleString("id-ID");

  const [db, pakasir] = await Promise.all([checkSupabase(), checkPakasir()]);
  const checks: Check[] = [
    db,
    pakasir,
    staticCheck(
      "WebRTC / TURN server",
      "Koneksi media panggilan video.",
      "Belum dikonfigurasi — memakai STUN publik. TURN wajib sebelum produksi."
    ),
    staticCheck(
      "Email service",
      "Notifikasi email (jika dibutuhkan).",
      "Belum dikonfigurasi."
    ),
    staticCheck(
      "Matching worker",
      "Antrean pencocokan acak.",
      "Berjalan di client via Supabase Realtime (tidak ada worker terpusat)."
    ),
    staticCheck(
      "Background jobs",
      "Job terjadwal.",
      "Belum ada job terjadwal terdaftar untuk admin."
    ),
  ];

  return (
    <div>
      <PageTitle
        title="Kesehatan Sistem"
        sub={`Pemeriksaan langsung saat halaman dibuka · ${checkedAt}. Tidak menampilkan secret.`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {checks.map((c) => (
          <Card key={c.name} title={c.name} sub={c.desc} action={<Badge tone={tone[c.status]}>{label[c.status]}</Badge>}>
            <p className="text-sm text-ink-soft">{c.detail}</p>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        Status “Unknown” berarti komponen belum dikonfigurasi atau tidak dapat
        dicek dari panel ini — bukan berarti rusak. Jangan menandai manual
        sebagai Healthy tanpa verifikasi nyata.
      </p>
    </div>
  );
}
