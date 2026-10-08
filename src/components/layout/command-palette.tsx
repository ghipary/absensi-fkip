"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import { MENU, LABEL_ROLE } from "@/lib/rbac";
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
  LogOut,
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

/** Pencarian global: navigasi + perintah akun (Cmd+K / Ctrl+K) */
export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command", onOpen);
    };
  }, []);

  function goto(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      loop
      className="[&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle [&_[cmdk-input]]:h-11 [&_[cmdk-input]]:text-base [&_[cmdk-item]]:h-9 [&_[cmdk-item]]:text-sm"
    >
      <CommandInput placeholder="Cari halaman atau perintah..." />
      <CommandList>
        <CommandEmpty>Tidak ada hasil yang cocok.</CommandEmpty>
        <CommandGroup heading={`Menu ${LABEL_ROLE[role]}`}>
          {MENU[role].map((item) => {
            const Icon = IKON[item.icon] ?? LayoutDashboard;
            return (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => goto(item.href)}
              >
                <Icon className="h-4 w-4 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Akun">
          <CommandItem value="Keluar" onSelect={logout}>
            <LogOut className="h-4 w-4 text-fg-subtle" strokeWidth={1.5} aria-hidden />
            Keluar dari akun
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
