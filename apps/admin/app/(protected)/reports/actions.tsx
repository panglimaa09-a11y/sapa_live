"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { reportAction, type ActionResult } from "@/lib/actions";

const initial: ActionResult = { ok: false };

export function ReportActions({
  reportId,
  reportedUserId,
}: {
  reportId: string;
  reportedUserId: string | null;
}) {
  const [state, formAction, pending] = useActionState(reportAction, initial);
  const [note, setNote] = useState("");

  const submit = (status: string) => {
    const form = new FormData();
    form.set("report_id", reportId);
    form.set("status", status);
    form.set("note", note);
    formAction(form);
  };

  return (
    <div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan internal (opsional)"
        className="mb-3 w-full rounded-xl border border-white/10 bg-paper px-3 py-2 text-sm outline-none placeholder:text-ink-soft/50 focus:border-accent"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("reviewed")}
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink disabled:opacity-60"
        >
          Tandai ditinjau
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("actioned")}
          className="rounded-full bg-accent px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
        >
          Tindaklanjuti
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("dismissed")}
          className="rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-ink-soft hover:text-ink disabled:opacity-60"
        >
          Abaikan
        </button>
        {reportedUserId && (
          <Link
            href={`/users/${reportedUserId}`}
            className="rounded-full border border-red-500/40 px-4 py-2 text-xs font-bold text-red-300"
          >
            Kelola akun terlapor
          </Link>
        )}
      </div>
      {state.error && <p className="mt-2 text-xs text-red-300">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-accent2">Tersimpan.</p>}
    </div>
  );
}
