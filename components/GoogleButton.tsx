"use client";

import { useState } from "react";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export default function GoogleButton() {
  const [busy, setBusy] = useState(false);

  const login = async () => {
    const sb = getSupabase();
    if (!sb) {
      alert(
        "Login Google belum dikonfigurasi.\n\nYang dibutuhkan:\n1. Buat project di supabase.com\n2. Aktifkan Google provider di Authentication\n3. Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local"
      );
      return;
    }
    setBusy(true);
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={login}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-white/15 bg-paper px-6 py-4 text-base font-bold transition-colors hover:border-white disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.6-5 3.6-8.9z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24z" />
          <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.5 0 10.2 0 12s.5 3.5 1.4 5.1l3.8-2.7z" />
          <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.4 6.9l3.8 2.8c1-2.9 3.7-5 6.8-5z" />
        </svg>
        {busy ? "Menghubungkan…" : "Lanjutkan dengan Google"}
      </button>
      {!supabaseConfigured && (
        <p className="mt-3 text-center text-sm font-medium text-ink-soft">
          Mode pratinjau: login aktif setelah Supabase dikonfigurasi.
        </p>
      )}
    </div>
  );
}
