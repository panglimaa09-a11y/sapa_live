"use client";

import Link from "next/link";
import { VideoCamera } from "@phosphor-icons/react";
import { useLang } from "../lib/i18n";

export default function Navbar() {
  const { t } = useLang();
  return (
    <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2" aria-label="SapaLive">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-[#1a1208]">
          <VideoCamera size={22} weight="fill" aria-hidden />
        </span>
        <span className="text-2xl font-extrabold tracking-tight">
          Sapa<span className="text-accent">Live</span>
        </span>
      </Link>
      <nav className="hidden items-center gap-8 text-[15px] font-semibold md:flex" aria-label="Navigasi utama">
        <a href="#fitur" className="text-ink-soft transition-colors hover:text-ink">
          {t("landing.feat_kicker")}
        </a>
        <a href="#cara-kerja" className="text-ink-soft transition-colors hover:text-ink">
          {t("landing.how_kicker")}
        </a>
        <a href="#faq" className="text-ink-soft transition-colors hover:text-ink">
          {t("landing.faq_kicker")}
        </a>
      </nav>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="hidden text-[15px] font-bold text-ink-soft transition-colors hover:text-ink sm:block"
        >
          {t("nav.login")}
        </Link>
        <Link
          href="/register"
          className="rounded-2xl bg-accent px-6 py-3 text-[15px] font-bold text-[#1a1208] transition-transform hover:-translate-y-0.5"
        >
          {t("landing.cta_start")}
        </Link>
      </div>
    </header>
  );
}
