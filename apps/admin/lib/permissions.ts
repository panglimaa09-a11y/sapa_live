// ============================================================================
// RBAC SapaLive Admin. Matriks izin per role; dipakai server actions & UI.
// ============================================================================

export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MODERATOR"
  | "FINANCE"
  | "SUPPORT";

export type Permission =
  | "users:read"
  | "users:write"
  | "users:suspend"
  | "creators:read"
  | "creators:write"
  | "verifications:read"
  | "verifications:write"
  | "calls:read"
  | "transactions:read"
  | "transactions:write"
  | "earnings:read"
  | "earnings:write"
  | "withdrawals:read"
  | "withdrawals:write"
  | "reports:read"
  | "reports:write"
  | "analytics:read"
  | "health:read"
  | "audit:read"
  | "settings:read"
  | "settings:write"
  | "access:read"
  | "access:write";

const ALL: Permission[] = [
  "users:read",
  "users:write",
  "users:suspend",
  "creators:read",
  "creators:write",
  "verifications:read",
  "verifications:write",
  "calls:read",
  "transactions:read",
  "transactions:write",
  "earnings:read",
  "earnings:write",
  "withdrawals:read",
  "withdrawals:write",
  "reports:read",
  "reports:write",
  "analytics:read",
  "health:read",
  "audit:read",
  "settings:read",
  "settings:write",
  "access:read",
  "access:write",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: [
    "users:read",
    "users:write",
    "users:suspend",
    "creators:read",
    "creators:write",
    "verifications:read",
    "verifications:write",
    "calls:read",
    "transactions:read",
    "earnings:read",
    "earnings:write",
    "withdrawals:read",
    "withdrawals:write",
    "reports:read",
    "reports:write",
    "analytics:read",
    "health:read",
    "audit:read",
    "settings:read",
  ],
  MODERATOR: [
    "users:read",
    "users:suspend",
    "verifications:read",
    "reports:read",
    "reports:write",
    "analytics:read",
  ],
  FINANCE: [
    "transactions:read",
    "transactions:write",
    "earnings:read",
    "earnings:write",
    "withdrawals:read",
    "withdrawals:write",
    "analytics:read",
    "health:read",
  ],
  SUPPORT: ["users:read", "reports:read"],
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export type MenuItem = {
  href: string;
  label: string;
  perm: Permission;
};

export const MENU: MenuItem[] = [
  { href: "/dashboard", label: "Ringkasan", perm: "analytics:read" },
  { href: "/users", label: "Pengguna", perm: "users:read" },
  { href: "/creators", label: "Kreator", perm: "creators:read" },
  { href: "/verifications", label: "Verifikasi", perm: "verifications:read" },
  { href: "/calls", label: "Panggilan", perm: "calls:read" },
  { href: "/transactions", label: "Transaksi", perm: "transactions:read" },
  { href: "/earnings", label: "Penghasilan", perm: "earnings:read" },
  { href: "/withdrawals", label: "Penarikan", perm: "withdrawals:read" },
  { href: "/reports", label: "Laporan", perm: "reports:read" },
  { href: "/moderation", label: "Moderasi", perm: "reports:write" },
  { href: "/system-health", label: "Kesehatan Sistem", perm: "health:read" },
  { href: "/audit-logs", label: "Audit Log", perm: "audit:read" },
  { href: "/settings", label: "Pengaturan", perm: "settings:read" },
  { href: "/access-control", label: "Akses & Role", perm: "access:read" },
];
