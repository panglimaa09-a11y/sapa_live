"use client";

import { useEffect, useState } from "react";
import { startMfaEnrollAction } from "@/lib/actions";
import { MfaEnrollForm } from "./form";

export function MfaSetupClient() {
  const [qr, setQr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await startMfaEnrollAction();
      if (!alive) return;
      if (res.ok) {
        setQr(res.qrDataUrl);
        setEmail(res.email);
      } else {
        setError(res.error);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <a href="/login" className="mt-4 inline-block font-bold text-accent hover:underline">
          Kembali ke login
        </a>
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="rounded-3xl border border-white/10 bg-surface p-8 text-center">
        <p className="text-sm text-ink-soft">Menyiapkan QR…</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-surface p-6 sm:p-8">
      <div className="mx-auto w-fit rounded-2xl bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code enroll MFA" width={200} height={200} />
      </div>
      <p className="mt-3 text-center text-xs text-ink-soft">Akun: {email}</p>
      <MfaEnrollForm />
    </div>
  );
}
