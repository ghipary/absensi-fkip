import { prisma } from "@/lib/prisma";
import type { Hari } from "@prisma/client";

export const DAFTAR_HARI: Hari[] = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export type JadwalInput = {
  hari?: string;
  jamMulai?: string;
  jamSelesai?: string;
  ruang?: string;
};

export type DataJadwal = {
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
  ruang: string;
};

/** Validasi input jadwal; mengembalikan data siap simpan atau pesan galat. */
export function validasiJadwal(
  input: JadwalInput | null | undefined
): { data?: DataJadwal; error?: string } {
  if (input === null || input === undefined) return { data: undefined };
  const hari = String(input.hari ?? "").trim();
  const jamMulai = String(input.jamMulai ?? "").trim();
  const jamSelesai = String(input.jamSelesai ?? "").trim();
  const ruang = String(input.ruang ?? "").trim();
  if (!DAFTAR_HARI.includes(hari as Hari)) {
    return { error: "Hari jadwal tidak valid." };
  }
  if (!/^\d{2}:\d{2}$/.test(jamMulai) || !/^\d{2}:\d{2}$/.test(jamSelesai)) {
    return { error: "Jam jadwal harus berformat HH:MM." };
  }
  if (jamSelesai <= jamMulai) {
    return { error: "Jam selesai harus setelah jam mulai." };
  }
  if (!ruang || ruang.length > 40) {
    return { error: "Ruang wajib diisi (maks 40 karakter)." };
  }
  return { data: { hari: hari as Hari, jamMulai, jamSelesai, ruang } };
}

/** Hitung jejak akademik sebuah kelas (untuk menentukan hapus permanen vs arsip). */
export async function hitungJejakKelas(kelasId: string) {
  const [krs, pertemuan, tugas, nilai, pengumuman, sesi] = await Promise.all([
    prisma.kRS.count({ where: { kelasId } }),
    prisma.pertemuan.count({ where: { kelasId } }),
    prisma.tugas.count({ where: { kelasId } }),
    prisma.nilai.count({ where: { kelasId } }),
    prisma.pengumuman.count({ where: { kelasId } }),
    prisma.sesiAbsensi.count({ where: { pertemuan: { kelasId } } }),
  ]);
  return krs + pertemuan + tugas + nilai + pengumuman + sesi;
}
