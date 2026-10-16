"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";
import LiveCounter from "./LiveCounter";

export default function Hero() {
  const { t } = useLang();
  return (
    <section className="relative overflow-hidden">
      {/* Garis cahaya hangat — seperti neon warung kopi */}
      <div
        className="pointer-events-none absolute -top-24 right-[-10%] h-72 w-[130%] -rotate-6 bg-accent/[0.07] blur-2xl"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-12 sm:px-8 lg:pt-20">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-leaf opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-leaf" />
            </span>
            <strong className="font-bold text-ink tabular-nums">
              <LiveCounter />
            </strong>
            {t("landing.live_now")}
          </p>

          <h1 className="mt-6 font-display text-[clamp(3.5rem,12vw,7rem)] leading-[0.95] tracking-wide text-ink">
            {t("landing.hero_title")}
          </h1>

          <p className="mt-5 max-w-[44ch] text-lg leading-relaxed text-ink-soft">
            {t("landing.hero_sub")}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2.5 rounded-2xl bg-accent px-8 py-4 text-base font-extrabold text-[#1a1208] transition-transform hover:-translate-y-0.5"
            >
              {t("landing.cta_start")}
              <ArrowRight
                size={20}
                weight="bold"
                aria-hidden
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <Link
              href="#cara-kerja"
              className="rounded-2xl px-6 py-4 text-base font-bold text-ink-soft underline decoration-accent/50 decoration-2 underline-offset-8 transition-colors hover:text-ink"
            >
              {t("landing.cta_how")}
            </Link>
          </div>

          <p className="mt-8 border-l-2 border-accent/60 pl-4 text-sm leading-relaxed text-ink-soft">
            {t("landing.social_proof")}
          </p>
        </div>
      </div>
    </section>
  );
}
