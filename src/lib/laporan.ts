import { prisma } from "./prisma";
import { statistikKehadiran } from "./grade";
import { muatRincianKehadiran, hitunganKelas } from "./kehadiran";

/**
 * Satu sumber kebenaran untuk laporan akademik kaprodi.
 * Dipakai bersama oleh halaman /kaprodi/laporan dan endpoint ekspor
 * (/api/laporan/export) supaya angka di layar & berkas selalu identik.
 */

export const NAMA_BULAN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export type InfoSemester = { id: string; nama: string; tahun: string };

export type BarisMahasiswaLaporan = {
  nim: string;
  nama: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  persen: number;
  memenuhi: boolean;
  nilaiAkhir: number | null;
  grade: string | null;
};

export type RingkasanKelasLaporan = {
  kelasId: string;
  kode: string;
  mataKuliah: string;
  kelas: string;
  sks: number;
  dosen: string;
  jumlahMahasiswa: number;
  totalPertemuan: number;
  rataKehadiran: number;
  diBawah75: number;
  mahasiswa: BarisMahasiswaLaporan[];
};

export type DataLaporan = {
  semester: InfoSemester | null;
  kelas: RingkasanKelasLaporan[];
  rataProdi: number;
  distribusiNilai: { grade: string; jumlah: number }[];
  rataNilai: number | null;
  trenBulanan: { periode: string; persen: number }[];
  jumlahBerisiko: number;
  dicetakPada: Date;
};

function bulat1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Kosongkan seluruh laporan bila tak ada semester aktif. */
function laporanKosong(dicetakPada: Date): DataLaporan {
  return {
    semester: null,
    kelas: [],
    rataProdi: 0,
    distribusiNilai: ["A", "B", "C", "D", "E"].map((grade) => ({ grade, jumlah: 0 })),
    rataNilai: null,
    trenBulanan: [],
    jumlahBerisiko: 0,
    dicetakPada,
  };
}

export async function muatLaporanSemester(): Promise<DataLaporan> {
  const dicetakPada = new Date();

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahun: { select: { nama: true } } },
  });
  if (!semesterAktif) return laporanKosong(dicetakPada);

  const kelasList = await prisma.kelas.findMany({
    where: { semesterId: semesterAktif.id, deletedAt: null },
    include: {
      mataKuliah: true,
      dosen: { select: { nama: true } },
      pertemuan: { orderBy: { nomor: "asc" }, select: { id: true, tanggal: true } },
      krs: {
        where: { status: "diambil" },
        include: { mahasiswa: { select: { id: true, nim: true, nama: true } } },
        orderBy: { mahasiswa: { nim: "asc" } },
      },
    },
    orderBy: { mataKuliah: { kode: "asc" } },
  });

  const kelasIds = kelasList.map((k) => k.id);

  const [nilaiRows, trenAbsen, rincian] = await Promise.all([
    kelasIds.length > 0
      ? prisma.nilai.findMany({
          where: { kelasId: { in: kelasIds } },
          select: { kelasId: true, mahasiswaId: true, akhir: true, grade: true },
        })
      : Promise.resolve([] as { kelasId: string; mahasiswaId: string; akhir: number | null; grade: string | null }[]),
    prisma.absensi.findMany({
      where: { pertemuan: { kelas: { semesterId: semesterAktif.id } } },
      select: { status: true, pertemuan: { select: { tanggal: true } } },
    }),
    muatRincianKehadiran(semesterAktif.id),
  ]);

  const nilaiByKelasMhs = new Map<string, { akhir: number | null; grade: string | null }>();
  for (const n of nilaiRows) {
    nilaiByKelasMhs.set(`${n.kelasId}:${n.mahasiswaId}`, { akhir: n.akhir, grade: n.grade });
  }

  const kelas: RingkasanKelasLaporan[] = kelasList.map((k) => {
    const totalPertemuan = k.pertemuan.length;
    const mahasiswa: BarisMahasiswaLaporan[] = k.krs.map((r) => {
      const e = hitunganKelas(rincian, k.id, r.mahasiswa.id);
      const stat = statistikKehadiran(totalPertemuan, e.hadir);
      const n = nilaiByKelasMhs.get(`${k.id}:${r.mahasiswa.id}`);
      return {
        nim: r.mahasiswa.nim,
        nama: r.mahasiswa.nama,
        hadir: e.hadir,
        sakit: e.sakit,
        izin: e.izin,
        alpha: e.alpha,
        persen: stat.persen,
        memenuhi: stat.memenuhi,
        nilaiAkhir: n?.akhir ?? null,
        grade: n?.grade ?? null,
      };
    });
    const rataKehadiran = mahasiswa.length
      ? bulat1(mahasiswa.reduce((s, m) => s + m.persen, 0) / mahasiswa.length)
      : 0;
    return {
      kelasId: k.id,
      kode: k.mataKuliah.kode,
      mataKuliah: k.mataKuliah.nama,
      kelas: k.kodeKelas,
      sks: k.mataKuliah.sks,
      dosen: k.dosen.nama,
      jumlahMahasiswa: mahasiswa.length,
      totalPertemuan,
      rataKehadiran,
      diBawah75: mahasiswa.filter((m) => !m.memenuhi).length,
      mahasiswa,
    };
  });

  const rataProdi = kelas.length
    ? bulat1(kelas.reduce((a, k) => a + k.rataKehadiran, 0) / kelas.length)
    : 0;

  // Distribusi grade & rata-rata nilai akhir
  const hitungGrade = new Map(["A", "B", "C", "D", "E"].map((g) => [g, 0]));
  const daftarAkhir: number[] = [];
  for (const n of nilaiRows) {
    if (n.grade) hitungGrade.set(n.grade, (hitungGrade.get(n.grade) ?? 0) + 1);
    if (n.akhir !== null) daftarAkhir.push(n.akhir);
  }
  const distribusiNilai = [...hitungGrade.entries()].map(([grade, jumlah]) => ({ grade, jumlah }));
  const rataNilai = daftarAkhir.length
    ? bulat1(daftarAkhir.reduce((a, b) => a + b, 0) / daftarAkhir.length)
    : null;

  // Tren kehadiran per bulan
  const perBulan = new Map<string, { hadir: number; total: number }>();
  for (const a of trenAbsen) {
    const d = a.pertemuan.tanggal;
    const kunci = `${d.getFullYear()}-${d.getMonth()}`;
    const e = perBulan.get(kunci) ?? { hadir: 0, total: 0 };
    e.total += 1;
    if (a.status === "hadir") e.hadir += 1;
    perBulan.set(kunci, e);
  }
  const trenBulanan = [...perBulan.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kunci, e]) => {
      const [, bulanIdx] = kunci.split("-").map(Number);
      return {
        periode: `${NAMA_BULAN[bulanIdx] ?? bulanIdx} ${kunci.slice(0, 4)}`,
        persen: Math.round((e.hadir / e.total) * 1000) / 10,
      };
    });

  // Mahasiswa berisiko: akumulasi lintas kelas per mahasiswa
  const hitungGlobal = new Map<string, { hadir: number; total: number }>();
  for (const k of kelasList) {
    const totalP = k.pertemuan.length;
    for (const r of k.krs) {
      const e = hitunganKelas(rincian, k.id, r.mahasiswa.id);
      const cur = hitungGlobal.get(r.mahasiswa.id) ?? { hadir: 0, total: 0 };
      cur.total += totalP;
      cur.hadir += Math.min(e.hadir, totalP);
      hitungGlobal.set(r.mahasiswa.id, cur);
    }
  }
  const jumlahBerisiko = [...hitungGlobal.values()].filter(
    (h) => !statistikKehadiran(h.total, h.hadir).memenuhi && h.total >= 1
  ).length;

  return {
    semester: {
      id: semesterAktif.id,
      nama: semesterAktif.nama,
      tahun: semesterAktif.tahun.nama,
    },
    kelas,
    rataProdi,
    distribusiNilai,
    rataNilai,
    trenBulanan,
    jumlahBerisiko,
    dicetakPada,
  };
}

/** Label semester, mis. "Ganjil 2025/2026". */
export function labelSemester(semester: InfoSemester | null): string {
  if (!semester) return "Semester berjalan";
  return `${semester.nama} ${semester.tahun}`;
}

/** Nama berkas aman (tanpa karakter terlarang) & bertanggal. */
export function namaBerkasLaporan(ekstensi: string, data: DataLaporan): string {
  const tgl = data.dicetakPada;
  const ymd = `${tgl.getFullYear()}${String(tgl.getMonth() + 1).padStart(2, "0")}${String(
    tgl.getDate()
  ).padStart(2, "0")}`;
  const sem = data.semester
    ? `${data.semester.nama}-${data.semester.tahun}`.replace(/[^\w-]+/g, "_")
    : "semester";
  return `laporan-akademik_${sem}_${ymd}.${ekstensi}`;
}

/** Tanggal & jam cetak dalam format Indonesia. */
export function stempelCetak(tgl: Date): string {
  const jam = `${String(tgl.getHours()).padStart(2, "0")}:${String(tgl.getMinutes()).padStart(2, "0")}`;
  return `${tgl.getDate()} ${NAMA_BULAN[tgl.getMonth()]} ${tgl.getFullYear()} ${jam}`;
}
