"use client";

import {
  VideoCamera,
  ShieldCheck,
  FastForward,
} from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";

export default function Features() {
  const { t } = useLang();
  const features = [
    { icon: VideoCamera, title: t("landing.feat_1t"), text: t("landing.feat_1d") },
    { icon: ShieldCheck, title: t("landing.feat_2t"), text: t("landing.feat_2d") },
    { icon: FastForward, title: t("landing.feat_3t"), text: t("landing.feat_3d") },
  ];
  return (
    <section id="fitur" className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
      <h2 className="max-w-2xl font-display text-5xl tracking-tight font-semibold sm:text-6xl">
        {t("landing.feat_title")}
      </h2>

      <div className="mt-14 space-y-6">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`grid items-center gap-6 rounded-[28px] border border-white/10 bg-surface p-8 sm:p-10 lg:grid-cols-12 ${
              i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div className="lg:col-span-2">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <f.icon size={30} weight="duotone" aria-hidden />
              </span>
            </div>
            <div className="lg:col-span-4">
              <h3 className="text-2xl font-extrabold tracking-tight">{f.title}</h3>
            </div>
            <p className="max-w-[52ch] text-base leading-relaxed text-ink-soft lg:col-span-6">
              {f.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
