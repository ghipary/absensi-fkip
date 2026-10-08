"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import type { Role } from "@prisma/client";

/**
 * Kerangka halaman: sidebar fixed 240px (drawer di tablet),
 * topbar dengan breadcrumb + user menu, konten utama di kanan.
 * Segmen breadcrumb diturunkan dari pathname aktif.
 */
export function DashboardShell({
  role,
  nama,
  sublabel,
  children,
}: {
  role: Role;
  nama: string;
  sublabel: string;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        role={role}
        nama={nama}
        sublabel={sublabel}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="lg:pl-60">
        <Topbar
          role={role}
          nama={nama}
          segments={segments}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
      <CommandPalette role={role} />
    </div>
  );
}
