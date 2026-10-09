import { prisma } from "@/lib/prisma";
import type { JenisSemester } from "@/lib/semester";

/**
 * Jenis semester aktif saat ini — dipakai API untuk memvalidasi paritas
 * `semesterKe`. Fallback "Ganjil" bila belum ada semester yang aktif.
 */
export async function jenisSemesterAktif(): Promise<JenisSemester> {
  const s = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { nama: true },
  });
  return (s?.nama ?? "Ganjil") as JenisSemester;
}
