"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";

export default function Cta() {
  const { t } = useLang();
  return (
    <section id="mulai" className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:pb-28">
      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-surface px-6 py-16 text-center sm:px-12 lg:py-24">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent2/10 blur-3xl" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-4xl font-extrabold tracking-tighter sm:text-5xl lg:text-6xl">
            {t("landing.cta_title")}
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
            {t("landing.cta_sub")}
          </p>
          <Link
            href="/register"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-accent px-10 py-4 text-lg font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            {t("landing.cta_start")}
            <ArrowRight size={22} weight="bold" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
