export default function Manifesto() {
  return (
    <section className="border-y-2 border-white/10 bg-surface/80" aria-label="Manifesto SapaLive">
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <p className="text-2xl font-extrabold leading-snug tracking-tight sm:text-4xl lg:text-5xl">
          Bukan feed yang di-scroll tanpa ujung.
          <br />
          <span className="text-ink-soft">
            Bukan algoritma yang menebak maumu.
          </span>
        </p>
        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-ink-soft">
          Hanya dua orang, bertatap muka lewat layar, berbagi beberapa menit yang
          nyata. SapaLive mengembalikan internet ke fungsi paling dasarnya:
          mempertemukan manusia.
        </p>
      </div>
    </section>
  );
}
