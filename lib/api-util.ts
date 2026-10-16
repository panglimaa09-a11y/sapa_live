// Helper kecil untuk API routes Sapa.live (server saja).
// Envelope: {ok:true, ...} atau {ok:false, error:'CODE', ...}.
import { NextResponse } from "next/server";
import { getAuthedUser, getServiceClient } from "./server";

export function ok(data: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...data });
}

export function fail(
  error: string,
  status = 400,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function readJson(
  req: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    if (body && typeof body === "object")
      return body as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

export type AuthedCtx = {
  user: { id: string; email?: string };
  profile: import("./server").Profile | null;
  svc: ReturnType<typeof getServiceClient>;
};

/** True bila backend Supabase dikonfigurasi (ada URL). */
export function backendConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

/** Null bila belum login. */
export async function requireUser(): Promise<AuthedCtx | null> {
  const authed = await getAuthedUser();
  if (!authed) return null;
  return { ...authed, svc: getServiceClient() };
}
