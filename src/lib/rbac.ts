import type { Role } from "./konstanta";

export { LABEL_ROLE } from "./konstanta";
export type { Role } from "./konstanta";

/** Prefix route → role yang diizinkan. Dipakai middleware + guard halaman. */
export const ROLE_ROUTE: Record<string, Role> = {
  "/mahasiswa": "mahasiswa",
  "/dosen": "dosen",
  "/kaprodi": "kaprodi",
  "/admin": "admin",
};

export function cocokkanRole(pathname: string, role: Role): boolean {
  for (const [prefix, r] of Object.entries(ROLE_ROUTE)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return r === role;
    }
  }
  return true; // route publik (landing, login, dsb.)
}

/** Menu sidebar per role — satu sumber kebenaran navigasi. */
export type MenuItem = {
  label: string;
  href: string;
  icon: string; // nama ikon Lucide
};

const MENU_MAHASISWA: MenuItem[] = [
  { label: "Dashboard", href: "/mahasiswa", icon: "LayoutDashboard" },
  { label: "Jadwal Kuliah", href: "/mahasiswa/jadwal", icon: "CalendarDays" },
  { label: "Materi Kuliah", href: "/mahasiswa/materi", icon: "BookOpen" },
  { label: "Absensi", href: "/mahasiswa/absensi", icon: "QrCode" },
];

const MENU_DOSEN: MenuItem[] = [
  { label: "Dashboard", href: "/dosen", icon: "LayoutDashboard" },
  { label: "Materi Kuliah", href: "/dosen/materi", icon: "BookOpen" },
  { label: "Verifikasi Absensi", href: "/dosen/absensi", icon: "ClipboardCheck" },
];

const MENU_KAPRODI: MenuItem[] = [
  { label: "Dashboard Prodi", href: "/kaprodi", icon: "LayoutDashboard" },
  { label: "Monitoring", href: "/kaprodi/monitoring", icon: "Activity" },
  { label: "Rekap & Laporan", href: "/kaprodi/rekap", icon: "BarChart3" },
];

const MENU_ADMIN: MenuItem[] = [
  { label: "Dashboard", href: "/admin", icon: "LayoutDashboard" },
  { label: "Kelola Pengguna", href: "/admin/pengguna", icon: "UsersRound" },
  { label: "Data Akademik", href: "/admin/data", icon: "Database" },
  { label: "Sinkronisasi", href: "/admin/sinkronisasi", icon: "RefreshCw" },
];

export const MENU: Record<Role, MenuItem[]> = {
  mahasiswa: MENU_MAHASISWA,
  dosen: MENU_DOSEN,
  kaprodi: MENU_KAPRODI,
  admin: MENU_ADMIN,
};
