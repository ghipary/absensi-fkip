import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import type { NamaSemester } from "@prisma/client";

/**
 * Cache data referensi akademik yang jarang berubah.
 *
 * Halaman dashboard bersifat *dynamic* (membaca cookie sesi), sehingga Next.js
 * tidak pernah meng-cache halaman. Trik di sini adalah meng-cache **query**-nya,
 * bukan halamannya, lewat `unstable_cache`. Cache diinvalidate eksplisit dengan
 * `revalidateTag(TAG_SEMESTER)` saat kaprodi mengganti semester aktif.
 */

export const TAG_SEMESTER = "semester";

export type SemesterAktif = {
  id: string;
  nama: NamaSemester;
  isAktif: boolean;
  tahun: { nama: string };
};

/**
 * Semester aktif beserta nama tahun — dipakai di hampir semua halaman.
 * Dikembalikan sebagai DTO primitif (tanpa Date) agar aman diserialisasi cache.
 */
export const cacheSemesterAktif = unstable_cache(
  async (): Promise<SemesterAktif | null> => {
    const s = await prisma.semester.findFirst({
      where: { isAktif: true },
      select: {
        id: true,
        nama: true,
        isAktif: true,
        tahun: { select: { nama: true } },
      },
    });
    return s;
  },
  ["semester-aktif"],
  { revalidate: 300, tags: [TAG_SEMESTER] }
);
