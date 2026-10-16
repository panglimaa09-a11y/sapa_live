"use client";

import {
  CursorClick,
  VideoCamera,
  ChatCircleText,
} from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";

export default function HowItWorks() {
  const { t } = useLang();
  const steps = [
    { icon: CursorClick, title: t("landing.how_1t"), text: t("landing.how_1d") },
    { icon: VideoCamera, title: t("landing.how_2t"), text: t("landing.how_2d") },
    { icon: ChatCircleText, title: t("landing.how_3t"), text: t("landing.how_3d") },
  ];
  return (
    <section id="cara-kerja" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
      <h2 className="max-w-2xl font-display text-5xl tracking-tight font-semibold sm:text-6xl">
        {t("landing.how_title")}
      </h2>

      <ol className="mt-12 grid gap-10 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="relative">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <s.icon size={26} weight="duotone" aria-hidden />
            </span>
            <h3 className="mt-5 text-xl font-extrabold tracking-tight">{s.title}</h3>
            <p className="mt-2 max-w-[38ch] leading-relaxed text-ink-soft">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
