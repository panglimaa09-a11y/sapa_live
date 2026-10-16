"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-7xl font-semibold tabular-nums text-accent">!</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
        Ada yang tidak beres
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Terjadi kesalahan saat memuat halaman ini. Coba muat ulang.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-2xl bg-accent px-8 py-4 text-base font-extrabold text-[#1a1208]"
        >
          Muat Ulang
        </button>
        <Link
          href="/"
          className="rounded-2xl border-2 border-white/10 px-8 py-4 text-base font-bold text-ink-soft"
        >
          Beranda
        </Link>
      </div>
    </main>
  );
}
