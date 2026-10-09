"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MENU, LABEL_ROLE, type MenuItem } from "@/lib/rbac";
import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  QrCode,
  ClipboardList,
  CalendarDays,
  GraduationCap,
  Megaphone,
  UserRound,
  PenLine,
  TableProperties,
  Activity,
  UsersRound,
  ShieldCheck,
  BarChart3,
  Settings2,
  type LucideIcon,
} from "lucide-react";

const IKON: Record<string, LucideIcon> = {
  LayoutDashboard,
  QrCode,
  ClipboardList,
  CalendarDays,
  GraduationCap,
  Megaphone,
  UserRound,
  PenLine,
  TableProperties,
  Activity,
  UsersRound,
  ShieldCheck,
  BarChart3,
  Settings2,
};

export function Sidebar({
  role,
  nama,
  sublabel,
  open,
  onClose,
}: {
  role: Role;
  nama: string;
  sublabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const items = MENU[role];

  const aktif = (item: MenuItem) =>
    item.href === `/${role}`
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <>
      {/* Overlay untuk tablet */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-overlay lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface-gradient",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
        aria-label="Navigasi utama"
      >
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-gradient text-white shadow-sm animate-gradient-pan">
            <GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-fg">
              SIAKAD FKIP
            </p>
            <p className="truncate text-2xs leading-tight text-fg-subtle">
              Pendidikan Matematika
            </p>
          </div>
        </div>

        {/* Navigasi */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <p className="mb-1.5 px-2 text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
            {LABEL_ROLE[role]}
          </p>
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = IKON[item.icon] ?? LayoutDashboard;
              const active = aktif(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-sm transition-all duration-200",
                      active
                        ? "bg-accent-subtle font-medium text-accent shadow-sm ring-1 ring-accent-border"
                        : "text-fg-muted hover:translate-x-0.5 hover:bg-surface-muted hover:text-fg"
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-pill bg-brand-gradient"
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-accent"
                          : "text-fg-subtle group-hover:text-fg-muted"
                      )}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer: identitas institusi */}
        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="text-2xs leading-relaxed text-fg-subtle">
            Universitas Wahidiyah
            <br />
            <span className="text-fg-subtle/80">FKIP · {sublabel}</span>
          </p>
        </div>
      </aside>
    </>
  );
}
