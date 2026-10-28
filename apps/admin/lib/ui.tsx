// avoid-ai-design-ignore-file: SD4 (konsol admin gaya NOC — label caps kecil adalah konvensi dasbor operasional, disetujui di Jarvis Dashboard)
import Link from "next/link";
import { MENU, can, type Permission, type Role } from "./permissions";
import { logoutAction } from "./actions";
import type { StaffSession } from "./auth";

/* ------------------------------------------------------------------ */
/* Shell admin: sidebar + topbar. Menu difilter berdasarkan izin role.  */
/* ------------------------------------------------------------------ */
export function AdminShell({
  staff,
  children,
}: {
  staff: StaffSession;
  children: React.ReactNode;
}) {
  const items = MENU.filter((m) => can(staff.role, m.perm));
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-surface/60 p-5 md:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg font-extrabold text-white">
            S
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-extrabold tracking-tight">
              SapaLive
            </span>
            <span className="block text-[11px] font-bold uppercase tracking-widest text-accent2">
              Admin
            </span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1" aria-label="Navigasi admin">
          {items.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="block rounded-xl px-3.5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-white/5 hover:text-ink"
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-6">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-bold text-ink-soft transition-colors hover:border-white/25 hover:text-ink"
            >
              Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* avoid-ai-design-ignore: K3 (sticky header di atas konten scroll — blur memang untuk layering) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-paper/90 px-4 py-3 backdrop-blur-xl sm:px-6">
          <p className="truncate text-sm font-bold text-ink-soft md:hidden">
            Panel Admin SapaLive
          </p>
          <div className="hidden items-center gap-2 md:flex">
            <RoleBadge role={staff.role} />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-sm text-ink-soft sm:block">
              {staff.email}
            </span>
            <RoleBadge role={staff.role} />
            <form action={logoutAction} className="md:hidden">
              <button
                type="submit"
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-ink-soft"
              >
                Keluar
              </button>
            </form>
          </div>
        </header>

        {/* Navigasi mobile: horizontal scroll */}
        <nav
          className="flex gap-1 overflow-x-auto border-b border-white/10 bg-surface/40 px-3 py-2 md:hidden"
          aria-label="Navigasi admin"
        >
          {items.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold text-ink-soft hover:bg-white/5 hover:text-ink"
            >
              {m.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const label: Record<Role, string> = {
    SUPER_ADMIN: "Super Admin",
    ADMIN: "Admin",
    MODERATOR: "Moderator",
    FINANCE: "Finance",
    SUPPORT: "Support",
  };
  return (
    <span className="rounded-full bg-accent/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-accent">
      {label[role]}
    </span>
  );
}

export function PageTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-soft">{sub}</p>
    </>
  );
  const cls =
    "rounded-2xl border border-white/10 bg-surface p-5 transition-colors";
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent/50`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Card({
  title,
  sub,
  children,
  action,
}: {
  title?: string;
  sub?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-surface p-5 sm:p-6">
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            )}
            {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "blue" | "gray";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    green: "bg-accent2/15 text-accent2",
    amber: "bg-amber-400/15 text-amber-300",
    red: "bg-red-500/15 text-red-300",
    blue: "bg-accent/15 text-accent",
    gray: "bg-white/5 text-ink-soft",
  };
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
      <p className="font-extrabold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{text}</p>
    </div>
  );
}

export function statusTone(s: string): "green" | "amber" | "red" | "blue" | "gray" {
  const v = s.toUpperCase();
  if (["ACTIVE", "VERIFIED", "PAID", "AVAILABLE", "APPROVED", "COMPLETED"].includes(v))
    return "green";
  if (["PENDING", "PENDING_REVIEW", "REQUESTED", "PROCESSING", "WITHDRAWAL_REQUESTED"].includes(v))
    return "amber";
  if (["BANNED", "SUSPENDED", "REJECTED", "FAILED", "REVERSED", "DECLINED"].includes(v))
    return "red";
  if (["INACTIVE", "UNVERIFIED"].includes(v)) return "gray";
  return "blue";
}

export function fmtNum(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("id-ID");
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type { Permission };
