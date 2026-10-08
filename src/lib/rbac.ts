import type { Role } from "@prisma/client";

/** Route prefix → role yang diizinkan. Dipakai middleware + guard halaman. */
export const ROLE_ROUTE: Record<string, Role> = {
  "/mahasiswa": "mahasiswa",
  "/dosen": "dosen",
  "/kaprodi": "kaprodi",
};

export function cocokkanRole(pathname: string, role: Role): boolean {
  for (const [prefix, r] of Object.entries(ROLE_ROUTE)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return r === role;
    }
  }
  return true; // route publik (login, dsb.)
}

export const LABEL_ROLE: Record<Role, string> = {
  mahasiswa: "Mahasiswa",
  dosen: "Dosen",
  kaprodi: "Kaprodi",
};

/** Menu sidebar per role — satu sumber kebenaran navigasi. */
export type MenuItem = {
  label: string;
  href: string;
  icon: string; // nama ikon Lucide
  badge?: "tugas" | "absensi" | "notifikasi";
};

export const MENU: Record<Role, MenuItem[]> = {
  mahasiswa: [
    { label: "Dashboard", href: "/mahasiswa", icon: "LayoutDashboard" },
    { label: "Absensi", href: "/mahasiswa/absensi", icon: "QrCode" },
    { label: "Tugas", href: "/mahasiswa/tugas", icon: "ClipboardList" },
    { label: "Jadwal Kuliah", href: "/mahasiswa/jadwal", icon: "CalendarDays" },
    { label: "Nilai", href: "/mahasiswa/nilai", icon: "GraduationCap" },
    { label: "Pengumuman", href: "/mahasiswa/pengumuman", icon: "Megaphone" },
    { label: "Kalender Akademik", href: "/kalender-akademik", icon: "CalendarDays" },
    { label: "KRS & Profil", href: "/mahasiswa/profil", icon: "UserRound" },
  ],
  dosen: [
    { label: "Dashboard", href: "/dosen", icon: "LayoutDashboard" },
    { label: "Kelola Absensi", href: "/dosen/absensi", icon: "QrCode" },
    { label: "Kelola Tugas", href: "/dosen/tugas", icon: "ClipboardList" },
    { label: "Input Nilai", href: "/dosen/nilai", icon: "PenLine" },
    { label: "Rekap Kelas", href: "/dosen/rekap", icon: "TableProperties" },
    { label: "Pengumuman", href: "/dosen/pengumuman", icon: "Megaphone" },
    { label: "Jadwal Mengajar", href: "/dosen/jadwal", icon: "CalendarDays" },
    { label: "Kalender Akademik", href: "/kalender-akademik", icon: "CalendarDays" },
    { label: "Profil", href: "/dosen/profil", icon: "UserRound" },
  ],
  kaprodi: [
    { label: "Dashboard", href: "/kaprodi", icon: "LayoutDashboard" },
    { label: "Monitoring Kehadiran", href: "/kaprodi/kehadiran", icon: "Activity" },
    { label: "Monitoring Dosen", href: "/kaprodi/dosen", icon: "UsersRound" },
    { label: "Validasi Data", href: "/kaprodi/validasi", icon: "ShieldCheck" },
    { label: "Statistik & Laporan", href: "/kaprodi/laporan", icon: "BarChart3" },
    { label: "Manajemen", href: "/kaprodi/manajemen", icon: "Settings2" },
    { label: "Pengumuman Prodi", href: "/kaprodi/pengumuman", icon: "Megaphone" },
    { label: "Kalender Akademik", href: "/kalender-akademik", icon: "CalendarDays" },
    { label: "Profil", href: "/kaprodi/profil", icon: "UserRound" },
  ],
};
