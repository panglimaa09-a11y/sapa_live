"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { VideoCamera } from "@phosphor-icons/react";

/**
 * Strip kartu preview video call yang auto-scroll horizontal.
 * Menggunakan avatar ilustrasi (bukan foto orang asli).
 */
const PREVIEWS = [
  { name: "Sinta", img: "/avatars/avatar-sinta.jpg", online: true },
  { name: "Rani", img: "/avatars/avatar-rani.jpg", online: true },
  { name: "Dewi", img: "/avatars/avatar-dewi.jpg", online: true },
  { name: "Nadia", img: "/avatars/avatar-nadia.jpg", online: true },
  { name: "Sinta", img: "/avatars/avatar-sinta.jpg", online: false },
  { name: "Rani", img: "/avatars/avatar-rani.jpg", online: false },
  { name: "Dewi", img: "/avatars/avatar-dewi.jpg", online: false },
  { name: "Nadia", img: "/avatars/avatar-nadia.jpg", online: true },
];

function Card({ name, img, online }: { name: string; img: string; online: boolean }) {
  return (
    <div className="relative h-44 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10">
      <Image
        src={img}
        alt={name}
        fill
        sizes="128px"
        className="object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
        <p className="truncate text-xs font-bold text-white">{name}</p>
        <p className="flex items-center gap-1 text-[10px] font-medium text-white/80">
          <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-400" : "bg-zinc-400"}`} />
          {online ? "Online" : "Offline"}
        </p>
      </div>
      {online && (
        <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[#1a1208]">
          <VideoCamera size={14} weight="fill" />
        </div>
      )}
    </div>
  );
}

export default function HeroVisual() {
  const [paused, setPaused] = useState(false);
  const doubled = [...PREVIEWS, ...PREVIEWS];

  useEffect(() => {
    if (paused) return;
    const el = document.getElementById("hero-strip");
    if (!el) return;
    let raf: number;
    let x = 0;
    const speed = 0.6;
    const step = () => {
      x += speed;
      const half = el.scrollWidth / 2;
      if (x >= half) x -= half;
      el.scrollLeft = x;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  return (
    <div
      className="relative mt-10 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        id="hero-strip"
        className="flex gap-3 overflow-x-hidden pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {doubled.map((p, i) => (
          <Card key={i} name={p.name} img={p.img} online={p.online} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-base to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-base to-transparent" />
    </div>
  );
}
