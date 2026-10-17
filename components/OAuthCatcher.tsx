"use client";

import { useEffect } from "react";
import { getSupabase } from "../lib/supabase";

/**
 * Menangkap kode OAuth di URL halaman mana pun.
 * Supabase kadang redirect ke Site URL (/) alih-alih ke /auth/callback
 * bila redirect URL belum di-whitelist di dashboard.
 * Komponen ini dipasang di root layout agar jalan di semua halaman.
 */
export default function OAuthCatcher() {
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (!code) return;

        const sb = getSupabase();
        if (!sb) return;

        const { error } = await sb.auth.exchangeCodeForSession(code);

        // Bersihkan code dari URL agar tidak di-exchange ulang
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.toString());

        if (!error) {
          // Login berhasil — arahkan ke welcome
          window.location.href = "/welcome";
        } else {
          // Debug: tampilkan error agar bisa dilacak
          console.error("[OAuthCatcher] exchange gagal:", error.message);
          // Simpan error ke sessionStorage untuk dibaca di halaman login
          try {
            sessionStorage.setItem("oauth_error", error.message);
          } catch {}
          window.location.href = "/login?error=auth&debug=" + encodeURIComponent(error.message.slice(0, 100));
        }
      } catch {
        // Abaikan — bukan alur OAuth
      }
    })();
  }, []);

  return null;
}
