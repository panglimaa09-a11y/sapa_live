import Link from "next/link";

export const metadata = {
  title: "Offline — SapaLive",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-extrabold tracking-tighter">Offline</p>
      <p className="mt-4 text-ink-soft">
        Kamu tidak terhubung ke internet. SapaLive butuh koneksi untuk
        mencarikan lawan bicara.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-accent px-8 py-3.5 font-extrabold text-white"
      >
        Coba lagi
      </Link>
    </main>
  );
}
