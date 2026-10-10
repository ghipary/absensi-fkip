"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { inisial } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusDot } from "@/components/ui/badge";
import {
  Menu,
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  UserRound,
  ChevronDown,
} from "lucide-react";
import { LABEL_ROLE } from "@/lib/rbac";
import type { Role } from "@/lib/konstanta";

export function Topbar({
  role,
  nama,
  segments,
  onToggleSidebar,
}: {
  role: Role;
  nama: string;
  segments: string[];
  onToggleSidebar: () => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => setMounted(true), []);

  // Jumlah notifikasi belum dibaca dari DB (badge bell)
  useEffect(() => {
    let batal = false;
    fetch("/api/notifikasi/ringkasan")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!batal && d && typeof d.belumDibaca === "number") {
          setNotifCount(d.belumDibaca);
        }
      })
      .catch(() => {
        /* biarkan 0 bila gagal */
      });
    return () => {
      batal = true;
    };
  }, []);

  // SSE: notifikasi real-time
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.judul) {
          toast(data.judul, { description: data.pesan });
          setNotifCount((c) => c + 1);
        }
      } catch {
        /* keepalive comment */
      }
    };
    es.onerror = () => {
      /* biarkan retry otomatis browser */
    };
    return () => es.close();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-sm lg:px-6">
      {/* Toggle sidebar (mobile & tablet) */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="inline-flex h-11 w-11 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
        aria-label="Buka menu navigasi"
      >
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* Breadcrumb — disembunyikan di mobile agar tidak berdesakan */}
      <div className="min-w-0 flex-1">
        <div className="hidden md:block">
          <Breadcrumb segments={segments} />
        </div>
      </div>

      {/* Cari global (Cmd+K) */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("open-command"))}
        className="hidden h-9 items-center gap-2 rounded border border-border bg-surface px-2.5 text-xs text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted md:flex"
        aria-label="Cari (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        Cari...
        <kbd className="rounded border border-border bg-surface-muted px-1 font-mono-nums text-2xs">
          Ctrl K
        </kbd>
      </button>

      {/* Notifikasi */}
      <button
        type="button"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent md:h-9 md:w-9"
        aria-label={`Notifikasi${notifCount > 0 ? `, ${notifCount} belum dibaca` : ""}`}
        onClick={() => {
          setNotifCount(0);
          router.push(`/${role}/pengumuman`);
        }}
      >
        <Bell className="h-4.5 w-4.5" strokeWidth={1.5} aria-hidden />
        {notifCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-0.5 font-mono-nums text-[10px] font-semibold leading-none text-white">
            {notifCount > 9 ? "9+" : notifCount}
          </span>
        )}
      </button>

      {/* Toggle tema */}
      <button
        type="button"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="inline-flex h-11 w-11 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg focus-visible:ring-2 focus-visible:ring-accent md:h-9 md:w-9"
        aria-label={
          resolvedTheme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"
        }
      >
        {mounted &&
          (resolvedTheme === "dark" ? (
            <Sun className="h-4.5 w-4.5" strokeWidth={1.5} aria-hidden />
          ) : (
            <Moon className="h-4.5 w-4.5" strokeWidth={1.5} aria-hidden />
          ))}
      </button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-11 items-center gap-2 rounded px-1.5 outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface-muted md:h-9">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-2xs">{inisial(nama)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-fg md:block">
            {nama.split(" ")[0]}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-fg-subtle md:block" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <StatusDot tone="success" />
            {LABEL_ROLE[role]}
          </DropdownMenuLabel>
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium text-fg">{nama}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push(`/${role}/profil`)}>
            <UserRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Profil saya
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={logout}>
            <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
