"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";

/**
 * OAuth callback — exchange code di CLIENT (browser), bukan server.
 * Alasan: iOS Safari ITP sering memblokir cookie yang di-set server
 * selama redirect chain OAuth (sapalive.my.id → supabase → google → balik).
 * Exchange di browser memakai PKCE verifier dari localStorage/cookie
 * yang di-set saat signInWithOAuth dipanggil — tidak kena blokir ITP.
 */
function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      const code = searchParams.get("code");

      if (!sb || !code) {
        router.replace("/login?error=auth");
        return;
      }

      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace("/login?error=auth");
        return;
      }

      // Domain kanonis — semua alur auth berakhir di sapalive.my.id
      router.replace("/welcome");
    })();
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-4 py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-accent" />
      <p className="mt-4 text-sm font-medium text-ink-soft">Menyelesaikan login…</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-4 py-12">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-accent" />
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
