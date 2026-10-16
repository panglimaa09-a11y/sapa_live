import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-7xl font-semibold tabular-nums text-accent">404</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Alamat yang kamu buka tidak ada atau sudah dipindahkan.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-2xl bg-accent px-8 py-4 text-base font-extrabold text-[#1a1208]"
      >
        Kembali ke Beranda
      </Link>
    </main>
  );
}
