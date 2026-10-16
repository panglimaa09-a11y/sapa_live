import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/lib/ui";

/**
 * Layout untuk semua halaman terproteksi.
 * proxy.ts sudah menggerbang di edge; di sini verifikasi diulang di server
 * (defense in depth — URL terpisah BUKAN satu-satunya lapisan keamanan).
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  return <AdminShell staff={staff}>{children}</AdminShell>;
}
