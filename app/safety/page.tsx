"use client";

import { ShieldCheck, Flag, Prohibit, IdentificationCard } from "@phosphor-icons/react";
import { useLang, usePageTitle } from "../../lib/i18n";

export default function SafetyPage() {
  const { t } = useLang();
  usePageTitle("Keamanan");
  const items = [
    { icon: IdentificationCard, title: t("safety.t1"), desc: t("safety.d1") },
    { icon: Flag, title: t("safety.t2"), desc: t("safety.d2") },
    { icon: Prohibit, title: t("safety.t3"), desc: t("safety.d3") },
    { icon: ShieldCheck, title: t("safety.t4"), desc: t("safety.d4") },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        {t("safety.title")}
      </h1>
      <p className="mt-2 text-ink-soft">{t("safety.sub")}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-[28px] border border-white/10 bg-surface p-6"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <it.icon size={24} weight="fill" />
            </span>
            <h2 className="mt-4 text-lg font-extrabold">{it.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{it.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
