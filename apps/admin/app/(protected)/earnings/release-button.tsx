"use client";

import { useActionState } from "react";
import { releaseEarningAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function ReleaseButton({ earningId }: { earningId: string }) {
  const [state, formAction, pending] = useActionState(releaseEarningAction, initial);
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="earning_id" value={earningId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent2 px-4 py-1.5 text-xs font-extrabold text-ink disabled:opacity-60"
      >
        {pending ? "…" : state.ok ? "Dirilis ✓" : "Release → Available"}
      </button>
      {state.error && <p className="mt-1 text-[11px] text-red-300">{state.error}</p>}
    </form>
  );
}
