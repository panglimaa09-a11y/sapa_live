import { headers } from "next/headers";
import { ok, fail, requireUser, backendConfigured } from "@/lib/api-util";
import { JARVIS_DECOYS, logHoneypotHit } from "@/lib/antibot";

// Discovery kreator perempuan: HANYA yang eligible & terverifikasi.
// Tanpa Supabase = tanpa data; tidak pernah menampilkan profil dummy.
export async function GET() {
  // Honeypot anti-scraping (perintah Tuan): scraper yang terdeteksi proxy
  // mendapat data umpan "Jarvis", BUKAN data kreator asli.
  const h = await headers();
  if (h.get("x-suspected-bot") === "1") {
    logHoneypotHit(
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      h.get("user-agent") ?? "",
      "/api/discover"
    );
    return ok({ creators: JARVIS_DECOYS });
  }
  // Mode demo: backend belum ada → daftar kosong yang jujur.
  if (!backendConfigured()) return ok({ creators: [], demo: true });
  const ctx = await requireUser();
  if (!ctx) return fail("UNAUTHENTICATED", 401);
  const { user, svc } = ctx;

  // Daftar blokir dua arah (jangan tampilkan yang saling blokir)
  const [b1, b2] = await Promise.all([
    svc.from("blocks").select("blocked_id").eq("blocker_id", user.id),
    svc.from("blocks").select("blocker_id").eq("blocked_id", user.id),
  ]);
  const blocked = new Set<string>([
    ...((b1.data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id),
    ...((b2.data ?? []) as { blocker_id: string }[]).map((r) => r.blocker_id),
  ]);

  let q = svc
    .from("profiles")
    .select(
      "id, display_name, is_available, creator_profiles!inner(avatar_url, bio, preferred_language, rate_tokens_per_interval)"
    )
    .eq("role", "FEMALE")
    .eq("verification_status", "VERIFIED")
    .eq("creator_status", "ACTIVE")
    .eq("account_status", "ACTIVE")
    .order("is_available", { ascending: false })
    .limit(100);

  const { data, error } = await q;
  if (error) return fail("DB_ERROR", 500);

  type CreatorRow = {
    id: string;
    display_name: string | null;
    is_available: boolean | null;
    creator_profiles: {
      avatar_url: string | null;
      bio: string | null;
      preferred_language: string | null;
      rate_tokens_per_interval: number | null;
    } | null;
  };
  const rows = ((data ?? []) as unknown as (Omit<CreatorRow, "creator_profiles"> & {
    creator_profiles:
      | CreatorRow["creator_profiles"]
      | NonNullable<CreatorRow["creator_profiles"]>[];
  })[]).map((r) => ({
    ...r,
    creator_profiles: Array.isArray(r.creator_profiles)
      ? (r.creator_profiles[0] ?? null)
      : r.creator_profiles,
  })) as CreatorRow[];

  const creators = rows
    .filter((r) => !blocked.has(r.id) && r.creator_profiles)
    .map((r) => ({
      user_id: r.id,
      display_name: r.display_name ?? "—",
      avatar_url: r.creator_profiles?.avatar_url ?? null,
      bio: r.creator_profiles?.bio ?? null,
      preferred_language: r.creator_profiles?.preferred_language ?? "id",
      rate_tokens_per_interval:
        r.creator_profiles?.rate_tokens_per_interval ?? 3,
      is_available: r.creator_profiles ? !!r.is_available : false,
      in_call: false,
    }));

  // Tandai yang sedang dalam panggilan (data nyata dari tabel calls).
  if (creators.length > 0) {
    const ids = creators.map((c) => c.user_id);
    const { data: live } = await svc
      .from("calls")
      .select("female_creator_id")
      .in("female_creator_id", ids)
      .eq("status", "ACCEPTED")
      .not("connected_at", "is", null)
      .is("ended_at", null);
    const busy = new Set((live ?? []).map((r) => r.female_creator_id));
    for (const c of creators) c.in_call = busy.has(c.user_id);
  }

  return ok({ creators });
}
