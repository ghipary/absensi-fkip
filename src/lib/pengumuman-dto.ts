import type { ItemPengumuman } from "@/components/pengumuman/panel-pengumuman";

type BarisPengumuman = {
  id: string;
  judul: string;
  konten: string;
  cakupan: "prodi" | "kelas";
  publishedAt: Date;
  kelas: { kodeKelas: string; mataKuliah: { kode: string; nama: string } } | null;
  pembuat: { dosen: { nama: string } | null };
};

/** Ubah baris pengumuman hasil query Prisma menjadi DTO untuk panel client. */
export function keItemPengumuman(
  row: BarisPengumuman,
  bisaDihapus = false
): ItemPengumuman {
  return {
    id: row.id,
    judul: row.judul,
    konten: row.konten,
    cakupan: row.cakupan,
    kelas: row.kelas
      ? {
          kode: row.kelas.mataKuliah.kode,
          nama: row.kelas.mataKuliah.nama,
          kodeKelas: row.kelas.kodeKelas,
        }
      : null,
    pembuat: row.pembuat.dosen?.nama ?? null,
    publishedAt: row.publishedAt.toISOString(),
    bisaDihapus,
  };
}