"use client";

import type { ReactNode } from "react";

/** Empty state yang niat: ilustrasi orbit + judul + ajakan, bukan kotak abu-abu. */
export default function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden
        className="animate-float"
      >
        <circle cx="60" cy="60" r="46" stroke="#6C7CFF" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="6 8" />
        <circle cx="60" cy="60" r="30" stroke="#35D6C0" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="60" cy="60" r="10" fill="#6C7CFF" />
        <circle cx="94" cy="42" r="7" fill="#35D6C0" />
        <circle cx="30" cy="82" r="5" fill="#6C7CFF" fillOpacity="0.6" />
      </svg>
      <h3 className="mt-6 text-xl font-extrabold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[38ch] text-[15px] leading-relaxed text-ink-soft">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
