"use client";

/** Radar berdenyut untuk halaman Cocokkan/Jelajahi — pusatnya angka live. */
export default function Radar({
  count,
  label,
  searching = false,
}: {
  count: number | null;
  label: string;
  searching?: boolean;
}) {
  return (
    <div className="relative mx-auto flex h-64 w-64 items-center justify-center" aria-hidden>
      <span className={`absolute inset-0 rounded-full border border-accent/25 ${searching ? "animate-ping-slow" : ""}`} />
      <span
        className={`absolute inset-6 rounded-full border border-accent/20 ${searching ? "animate-ping-slower" : ""}`}
      />
      <span className="absolute inset-12 rounded-full border border-accent2/20" />
      <span className="absolute inset-0 rounded-full bg-accent/10 blur-2xl" />
      <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25 blur-xl" />
      <div className="relative text-center">
        <p className="text-5xl font-extrabold tracking-tighter tabular-nums">
          {count === null ? "–" : count}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-ink-soft">{label}</p>
      </div>
      <span className="absolute right-8 top-10 flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent2 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-accent2" />
      </span>
    </div>
  );
}
