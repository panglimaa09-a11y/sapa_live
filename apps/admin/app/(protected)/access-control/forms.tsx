"use client";

import { useActionState, useState } from "react";
import { setAdminRoleAction, removeAdminRoleAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function RoleForms({
  roles,
  removeOnly,
  userId,
}: {
  roles: string[];
  removeOnly?: boolean;
  userId?: string;
}) {
  const [grantState, grantAction, granting] = useActionState(setAdminRoleAction, initial);
  const [revokeState, revokeAction, revoking] = useActionState(removeAdminRoleAction, initial);
  const [confirming, setConfirming] = useState(false);

  if (removeOnly && userId) {
    return (
      <div>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full border border-red-500/40 px-4 py-2 text-xs font-bold text-red-300"
          >
            Cabut
          </button>
        ) : (
          <form action={revokeAction} className="flex items-center gap-2">
            <input type="hidden" name="user_id" value={userId} />
            <button
              type="submit"
              disabled={revoking}
              className="rounded-full bg-red-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {revoking ? "…" : "Ya, cabut"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-xs text-ink-soft">
              Batal
            </button>
          </form>
        )}
        {revokeState.error && <p className="mt-1 text-xs text-red-300">{revokeState.error}</p>}
      </div>
    );
  }

  return (
    <form action={grantAction}>
      <div className="flex flex-wrap gap-2">
        <input
          name="user_id"
          required
          placeholder="UUID user"
          className="min-w-52 flex-1 rounded-xl border border-white/10 bg-paper px-3 py-2.5 font-mono text-xs outline-none placeholder:text-ink-soft/50 focus:border-accent"
        />
        <select name="role" className="rounded-xl border border-white/10 bg-paper px-3 py-2.5 text-sm">
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={granting}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {granting ? "…" : "Simpan role"}
        </button>
      </div>
      {grantState.error && <p className="mt-2 text-xs text-red-300">{grantState.error}</p>}
      {grantState.ok && <p className="mt-2 text-xs text-accent2">Role tersimpan & tercatat.</p>}
    </form>
  );
}
