/**
 * Konstanta domain — pengganti enum Prisma (SQLite tidak mendukung enum).
 * Satu sumber kebenaran untuk role, hari, status kehadiran, dan status verifikasi.
 * Dipakai bersama oleh server & klien (tanpa dependensi "use client").
 */

export const ROLE = ["mahasiswa", "dosen", "kaprodi", "admin"] as const;
export type Role = (typeof ROLE)[number];

export const LABEL_ROLE: Record<Role, string> = {
  mahasiswa: "Mahasiswa",
  dosen: "Dosen",
  kaprodi: "Kaprodi",
  admin: "Admin",
};

export const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
export type Hari = (typeof HARI)[number];
export const URUTAN_HARI: Record<string, number> = Object.fromEntries(
  HARI.map((h, i) => [h, i])
);

export const STATUS_KEHADIRAN = ["hadir", "sakit", "izin", "alpha"] as const;
export type StatusKehadiran = (typeof STATUS_KEHADIRAN)[number];

export const LABEL_KEHADIRAN: Record<StatusKehadiran, string> = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpha: "Alpha",
};

export const STATUS_VERIFIKASI = ["menunggu", "disetujui", "ditolak"] as const;
export type StatusVerifikasi = (typeof STATUS_VERIFIKASI)[number];

export const LABEL_VERIFIKASI: Record<StatusVerifikasi, string> = {
  menunggu: "Menunggu",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

export const STATUS_MAHASISWA = ["aktif", "cuti", "lulus", "keluar"] as const;

/** Validator ringan */
export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLE as readonly string[]).includes(v);
}
export function isStatusKehadiran(v: unknown): v is StatusKehadiran {
  return typeof v === "string" && (STATUS_KEHADIRAN as readonly string[]).includes(v);
}
export function isStatusVerifikasi(v: unknown): v is StatusVerifikasi {
  return typeof v === "string" && (STATUS_VERIFIKASI as readonly string[]).includes(v);
}
