import { requirePermission } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase";
import { PageTitle, Card, fmtDate } from "@/lib/ui";
import { GrantForm } from "./form";

export const dynamic = "force-dynamic";

export default async function TokensPage() {
  await requirePermission("tokens:grant");
  const svc = getServiceClient();
  const { data: grants } = await svc
    .from("admin_token_grants")
    .select("id, target_email, amount, note, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageTitle
        title="Kirim Token Gratis"
        sub="Kirim token gratis ke user via email. Semua pengiriman tercatat di audit log."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-bold">Form pengiriman</h2>
          <GrantForm />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-bold">Riwayat pengiriman</h2>
          {!grants?.length ? (
            <p className="text-sm text-ink-soft">Belum ada pengiriman.</p>
          ) : (
            <ul className="space-y-3">
              {grants.map((g) => (
                <li
                  key={g.id}
                  className="rounded-2xl border border-white/10 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{g.target_email}</span>
                    <span className="font-extrabold text-accent">
                      +{g.amount} token
                    </span>
                  </div>
                  {g.note ? (
                    <p className="mt-1 text-ink-soft">{g.note}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-ink-soft">
                    {fmtDate(g.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
