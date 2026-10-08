import { prisma } from "./prisma";

/**
 * Bantu hitung kehadiran yang TEPAT per kelas.
 *
 * Masalah lama: `absensi.groupBy({ by: ["mahasiswaId", "status"] })` menggabungkan
 * catatan absensi dari semua kelas ke akun mahasiswa yang sama → persen kehadiran
 * sebuah kelas bisa >100% (hadir mahasiswa di kelas lain ikut terhitung).
 *
 * Solusi: kelompokkan dulu tiap absensi ke (kelasId, mahasiswaId)-nya lewat
 * pertemuan, baru dihitung per kelas.
 */
export const HITUNGAN_KOSONG = { hadir: 0, sakit: 0, izin: 0, alpha: 0 } as const;

export type HitunganAbsen = { hadir: number; sakit: number; izin: number; alpha: number };
export type RincianKehadiran = Map<string, Map<string, HitunganAbsen>>;

/** Muat seluruh absensi dalam semester lalu kelompokkan per (kelas, mahasiswa). */
export async function muatRincianKehadiran(
  semesterId: string
): Promise<RincianKehadiran> {
  const [pertemuanList, absenList] = await Promise.all([
    prisma.pertemuan.findMany({
      where: { kelas: { semesterId } },
      select: { id: true, kelasId: true },
    }),
    prisma.absensi.findMany({
      where: { pertemuan: { kelas: { semesterId } } },
      select: { mahasiswaId: true, status: true, pertemuanId: true },
    }),
  ]);

  const kelasPertemuan = new Map(pertemuanList.map((p) => [p.id, p.kelasId]));
  const hasil: RincianKehadiran = new Map();

  for (const a of absenList) {
    const kelasId = kelasPertemuan.get(a.pertemuanId);
    if (!kelasId) continue;
    let perMhs = hasil.get(kelasId);
    if (!perMhs) {
      perMhs = new Map();
      hasil.set(kelasId, perMhs);
    }
    let e = perMhs.get(a.mahasiswaId);
    if (!e) {
      e = { ...HITUNGAN_KOSONG };
      perMhs.set(a.mahasiswaId, e);
    }
    if (a.status === "hadir") e.hadir++;
    else if (a.status === "sakit") e.sakit++;
    else if (a.status === "izin") e.izin++;
    else e.alpha++;
  }

  return hasil;
}

/** Hitungan absen satu mahasiswa pada satu kelas (aman bila tak ada catatan). */
export function hitunganKelas(
  rincian: RincianKehadiran,
  kelasId: string,
  mahasiswaId: string
): HitunganAbsen {
  return rincian.get(kelasId)?.get(mahasiswaId) ?? HITUNGAN_KOSONG;
}