import { prisma } from "./prisma";
import { broadcastNotifikasi } from "./sse-bus";
import type { TipeNotifikasi } from "@prisma/client";

/**
 * Kirim notifikasi ke sekumpulan user:
 * 1. Tulis baris di tabel notifikasi (persisten, tampil di riwayat).
 * 2. Broadcast SSE agar toast muncul real-time pada user yang sedang online.
 *
 * Gagal menyimpan notifikasi TIDAK boleh menjatuhkan request utama.
 */
export async function kirimNotifikasi(input: {
  userIds: string[];
  tipe: TipeNotifikasi;
  judul: string;
  pesan: string;
  link?: string;
}) {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (userIds.length > 0) {
    try {
      await prisma.notifikasi.createMany({
        data: userIds.map((userId) => ({
          userId,
          tipe: input.tipe,
          judul: input.judul,
          pesan: input.pesan,
          link: input.link ?? null,
        })),
      });
    } catch (e) {
      console.error("[notifikasi] gagal menyimpan:", e);
    }
  }
  broadcastNotifikasi(
    {
      judul: input.judul,
      pesan: input.pesan,
      link: input.link,
    },
    userIds
  );
}

/** Ambil userId semua mahasiswa peserta aktif sebuah kelas. */
export async function userIdPesertaKelas(kelasId: string): Promise<string[]> {
  const peserta = await prisma.kRS.findMany({
    where: { kelasId, status: "diambil" },
    select: { mahasiswa: { select: { userId: true } } },
  });
  return peserta.map((p) => p.mahasiswa.userId);
}
