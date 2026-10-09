import { prisma } from "@/lib/prisma";

/** Satu baris rincian data terkait yang akan ikut terhapus. */
export type RincianHapus = { label: string; jumlah: number };

/** Rincian data akademik milik seorang mahasiswa. */
export async function rincianHapusMahasiswa(
  id: string
): Promise<RincianHapus[]> {
  const [krs, absensi, submission, nilai, riwayat] = await Promise.all([
    prisma.kRS.count({ where: { mahasiswaId: id } }),
    prisma.absensi.count({ where: { mahasiswaId: id } }),
    prisma.submission.count({ where: { mahasiswaId: id } }),
    prisma.nilai.count({ where: { mahasiswaId: id } }),
    prisma.riwayatPerubahan.count({ where: { mahasiswaId: id } }),
  ]);
  return [
    { label: "KRS", jumlah: krs },
    { label: "Absensi", jumlah: absensi },
    { label: "Pengumpulan tugas", jumlah: submission },
    { label: "Nilai", jumlah: nilai },
    { label: "Riwayat perubahan", jumlah: riwayat },
  ];
}

/** Rincian jejak akademik milik dosen/kaprodi (termasuk isi kelas yang diampu). */
export async function rincianHapusDosen(
  dosenId: string,
  userId: string
): Promise<RincianHapus[]> {
  const [
    kelas,
    krsKelas,
    nilaiKelas,
    absensiKelas,
    sesi,
    tugas,
    pengumuman,
    riwayat,
  ] = await Promise.all([
    prisma.kelas.count({ where: { dosenId } }),
    prisma.kRS.count({ where: { kelas: { dosenId } } }),
    prisma.nilai.count({ where: { kelas: { dosenId } } }),
    prisma.absensi.count({ where: { pertemuan: { kelas: { dosenId } } } }),
    prisma.sesiAbsensi.count({ where: { dosenId } }),
    prisma.tugas.count({ where: { createdById: dosenId } }),
    prisma.pengumuman.count({ where: { createdById: userId } }),
    prisma.riwayatPerubahan.count({
      where: { OR: [{ diubahOlehId: userId }, { reviewedById: userId }] },
    }),
  ]);
  return [
    { label: "Kelas diampu", jumlah: kelas },
    { label: "KRS di kelas tersebut", jumlah: krsKelas },
    { label: "Nilai mahasiswa", jumlah: nilaiKelas },
    { label: "Absensi mahasiswa", jumlah: absensiKelas },
    { label: "Sesi absensi", jumlah: sesi },
    { label: "Tugas", jumlah: tugas },
    { label: "Pengumuman", jumlah: pengumuman },
    { label: "Riwayat perubahan", jumlah: riwayat },
  ];
}

/** Rincian jejak akademik sebuah kelas. */
export async function rincianHapusKelas(
  kelasId: string
): Promise<RincianHapus[]> {
  const [krs, pertemuan, absensi, tugas, submission, nilai, pengumuman, sesi] =
    await Promise.all([
      prisma.kRS.count({ where: { kelasId } }),
      prisma.pertemuan.count({ where: { kelasId } }),
      prisma.absensi.count({ where: { pertemuan: { kelasId } } }),
      prisma.tugas.count({ where: { kelasId } }),
      prisma.submission.count({ where: { tugas: { kelasId } } }),
      prisma.nilai.count({ where: { kelasId } }),
      prisma.pengumuman.count({ where: { kelasId } }),
      prisma.sesiAbsensi.count({ where: { kelasId } }),
    ]);
  return [
    { label: "KRS mahasiswa", jumlah: krs },
    { label: "Pertemuan", jumlah: pertemuan },
    { label: "Absensi", jumlah: absensi },
    { label: "Tugas", jumlah: tugas },
    { label: "Pengumpulan tugas", jumlah: submission },
    { label: "Nilai", jumlah: nilai },
    { label: "Pengumuman kelas", jumlah: pengumuman },
    { label: "Sesi absensi", jumlah: sesi },
  ];
}

/** Total keseluruhan data terkait dari daftar rincian. */
export function totalRincian(rincian: RincianHapus[]): number {
  return rincian.reduce((n, r) => n + r.jumlah, 0);
}
