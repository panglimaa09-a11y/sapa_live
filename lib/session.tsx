"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "../lib/supabase";

export interface Profile {
  id: string;
  display_name: string;
  birth_date: string;
  country: string | null;
  interests: string[];
  avatar_url: string | null;
  language: "id" | "en";
  show_online: boolean;
  allow_random: boolean;
  age_verified: boolean;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
  // Addendum v1.1.0 — role & status kreator
  role: "MALE" | "FEMALE" | string | null;
  verification_status: string | null;
  creator_status: string | null;
  account_status: string | null;
  is_available: boolean;
  bio: string | null;
  preferred_language: string | null;
}

interface SessionCtx {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  demo: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<SessionCtx>({
  user: null,
  profile: null,
  loading: true,
  demo: false,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    const {
      data: { session },
    } = await sb.auth.getSession();
    const u = session?.user ?? null;
    setUser(u);
    if (u) {
      const { data } = await sb
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const sb = getSupabase();
    if (!sb) return;

    // Tangkap kode OAuth di URL mana pun — Supabase kadang redirect ke Site URL
    // (/) alih-alih ke /auth/callback bila redirect URL belum di-whitelist.
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          // Bersihkan code dari URL agar tidak di-exchange ulang
          const url = new URL(window.location.href);
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.toString());
          if (!error) {
            await refresh();
            // Arahkan ke welcome setelah login OAuth berhasil
            if (window.location.pathname === "/") {
              window.location.href = "/welcome";
            }
          }
        }
      } catch {
        // Abaikan — bukan alur OAuth
      }
    })();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{ user, profile, loading, demo: !supabaseConfigured, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  return useContext(Ctx);
}

/** Melindungi route aplikasi: wajib login (kecuali mode demo tanpa Supabase). */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, demo } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !demo) router.replace("/login");
  }, [loading, user, demo, router]);

  if (loading || (!user && !demo)) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-accent" />
      </div>
    );
  }
  return <>{children}</>;
}
