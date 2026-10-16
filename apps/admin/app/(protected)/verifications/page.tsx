import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getServiceClient } from "@/lib/supabase";
import { approveCreatorAction, rejectCreatorAction } from "@/lib/actions";
import { PageTitle, Badge, Empty, Card, statusTone, fmtDate } from "@/lib/ui";
import { VerifyActions } from "./actions";

export const dynamic = "force-dynamic";

export default async function VerificationsPage() {
  const staff = await requirePermission("verifications:read");
  const svc = getServiceClient();

  const { data } = await svc
    .from("profiles")
    .select("id, display_name, role, age_verified, verification_status, creator_status, created_at")
    .eq("verification_status", "PENDING_REVIEW")
    .order("created_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as {
    id: string;
    display_name: string | null;
    role: string;
    age_verified: boolean | null;
    verification_status: string;
    creator_status: string;
    created_at: string;
  }[];

  const ids = rows.map((r) => r.id);
  const { data: cps } = ids.length
    ? await svc.from("creator_profiles").select("user_id, bio, preferred_language, avatar_url").in("user_id", ids)
    : { data: [] };
  const cp = new Map(
    ((cps ?? []) as { user_id: string; bio: string | null; preferred_language: string; avatar_url: string | null }[]).map(
      (c) => [c.user_id, c]
    )
  );
  // Skor verifikasi wajah (hanya skor, bukan data wajah — privasi)
  const { data: vrs } = ids.length
    ? await svc
        .from("verification_records")
        .select("user_id, provider, face_match_score, face_liveness_passed, face_verified_at")
        .in("user_id", ids)
        .eq("provider", "FACE_MATCH_LIVE")
        .order("created_at", { ascending: false })
    : { data: [] };
  const vr = new Map(
    ((vrs ?? []) as { user_id: string; face_match_score: number | null; face_liveness_passed: boolean | null }[]).map(
      (v) => [v.user_id, v]
    )
  );

  const canWrite = can(staff.role, "verifications:write");

  return (
    <div>
      <PageTitle
        title="Antrean Verifikasi"
        sub="Calon kreator menunggu tinjauan manual. Persetujuan HANYA jika memenuhi syarat: perempuan, 18+ terverifikasi."
      />

      {rows.length === 0 ? (
        <Empty
          title="Antrean kosong"
          text="Tidak ada pengajuan verifikasi yang menunggu. Data dari profiles.verification_status = PENDING_REVIEW."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const prof = cp.get(r.id);
            const face = vr.get(r.id);
            const eligible = r.role === "FEMALE" && r.age_verified === true;
            return (
              <Card key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {prof?.avatar_url ? (
                      <img src={prof.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/15 text-lg font-extrabold text-amber-300">
                        {(r.display_name ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <p className="font-extrabold">{r.display_name ?? "—"}</p>
                      <p className="text-xs text-ink-soft">
                        Role {r.role} · usia 18+: {r.age_verified ? "terverifikasi" : "BELUM"} ·
                        bahasa {prof?.preferred_language ?? "—"} · diajukan {fmtDate(r.created_at)}
                      </p>
                      {face?.face_match_score != null && (
                        <p className="mt-1 text-xs font-bold text-emerald-300">
                          Wajah: cocok {Math.max(0, Math.round((1 - face.face_match_score) * 100))}%
                          {face.face_liveness_passed ? " · liveness lolos" : " · liveness GAGAL"}
                        </p>
                      )}
                      {face == null && (
                        <p className="mt-1 text-xs font-bold text-amber-300">
                          Wajah: belum verifikasi kamera
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge tone={eligible ? "amber" : "red"}>
                    {eligible ? "Memenuhi syarat" : "Tidak memenuhi syarat"}
                  </Badge>
                </div>
                {prof?.bio && (
                  <p className="mt-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-ink-soft">
                    “{prof.bio}”
                  </p>
                )}
                {canWrite && (
                  <div className="mt-4 border-t border-white/5 pt-4">
                    <VerifyActions userId={r.id} eligible={eligible} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
