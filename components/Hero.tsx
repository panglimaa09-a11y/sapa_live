"use client";

import Link from "next/link";
import { ArrowRight, VideoCamera, ShieldCheck } from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";
import LiveCounter from "./LiveCounter";

export default function Hero() {
  const { t } = useLang();
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-14 pb-20 sm:px-6 lg:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent2 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent2" />
            </span>
            {t("landing.badge")}
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
            {t("landing.hero_title")}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-soft">
            {t("landing.hero_sub")}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 text-base font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              {t("landing.cta_start")}
              <ArrowRight size={20} weight="bold" aria-hidden />
            </Link>
            <Link
              href="#cara-kerja"
              className="rounded-full border-2 border-white/15 px-8 py-[14px] text-base font-bold transition-colors hover:border-white/40"
            >
              {t("landing.cta_how")}
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-soft">
            <span className="flex items-center gap-2">
              <VideoCamera size={20} className="text-accent" weight="fill" />
              <strong className="text-ink">
                <LiveCounter />
              </strong>
              {t("landing.live_now")}
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-accent2" weight="fill" />
              18+
            </span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-surface p-8">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-accent2/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white">
                  <VideoCamera size={24} weight="fill" />
                </span>
                <div>
                  <p className="font-extrabold">SapaLive</p>
                  <p className="text-xs text-ink-soft">{t("brand.tagline")}</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  t("landing.how_1t"),
                  t("landing.how_2t"),
                  t("landing.how_3t"),
                ].map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center gap-3 rounded-2xl bg-base/80 px-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-extrabold text-accent">
                      {i + 1}
                    </span>
                    <span className="text-sm font-bold">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
