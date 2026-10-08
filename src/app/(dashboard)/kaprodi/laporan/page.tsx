import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statistikKehadiran } from "@/lib/grade";
import { muatRincianKehadiran, hitunganKelas } from "@/lib/kehadiran";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Num,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/form-extras";
import { TombolCSV } from "@/components/charts/ekspor-csv";
import {
  GrafikKehadiran,
  GrafikDistribusiNilai,
  GrafikTrenKehadiran,
} from "@/components/charts/grafik";
import { Activity, AlertTriangle, Award, FileSpreadsheet, BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Laporan Akademik" };

const BULAN_ID = [
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

export default async function HalamanLaporanKaprodi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahun: { select: { nama: true } } },
  });

  const kelasList = semesterAktif
    ? await prisma.kelas.findMany({
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
      })
    : [];

  const semuaKelasIds = kelasList.map((k) => k.id);

  const [nilaiRows, trenAbsen, rincian] = await Promise.all([
    semuaKelasIds.length > 0
      ? prisma.nilai.findMany({
          where: { kelasId: { in: semuaKelasIds } },
          select: { kelasId: true, mahasiswaId: true, akhir: true, grade: true },
        })
      : [],
    semesterAktif
      ? prisma.absensi.findMany({
          where: { pertemuan: { kelas: { semesterId: semesterAktif.id } } },
          select: { status: true, pertemuan: { select: { tanggal: true } } },
        })
      : [],
    muatRincianKehadiran(semesterAktif?.id ?? ""),
  ]);

  // Ringkasan per kelas — hitungan hanya dari absensi kelas itu sendiri
  // (sebelumnya absensi lintas kelas tercampur → persen bisa >100%).
  const perKelas = kelasList.map((kelas) => {
    const totalPertemuan = kelas.pertemuan.length;
    const baris = kelas.krs.map((r) =>
      statistikKehadiran(
        totalPertemuan,
        hitunganKelas(rincian, kelas.id, r.mahasiswa.id).hadir
      )
    );
    const rata = baris.length
      ? Math.round((baris.reduce((s, x) => s + x.persen, 0) / baris.length) * 10) / 10
      : 0;
    const diBawah = baris.filter((x) => !x.memenuhi).length;
    return { kelas, totalPertemuan, rata, diBawah };
  });

  const rataProdi = perKelas.length
    ? Math.round((perKelas.reduce((a, k) => a + k.rata, 0) / perKelas.length) * 10) / 10
    : 0;

  // Grafik kehadiran per MK
  const dataKehadiran = perKelas.map((k) => ({
    nama: k.kelas.mataKuliah.nama,
    persen: k.rata,
    memenuhi: k.rata >= 75,
  }));

  // Distribusi nilai A–E
  const hitungGradeCount = new Map(["A", "B", "C", "D", "E"].map((g) => [g, 0]));
  const daftarAkhir: number[] = [];
  for (const n of nilaiRows) {
    if (n.grade) hitungGradeCount.set(n.grade, (hitungGradeCount.get(n.grade) ?? 0) + 1);
    if (n.akhir !== null) daftarAkhir.push(n.akhir);
  }
  const dataDistribusi = [...hitungGradeCount.entries()].map(([grade, jumlah]) => ({ grade, jumlah }));
  const rataNilai = daftarAkhir.length
    ? Math.round((daftarAkhir.reduce((a, b) => a + b, 0) / daftarAkhir.length) * 10) / 10
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
  const dataTren = [...perBulan.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kunci, e]) => {
      const [, bulanIdx] = kunci.split("-").map(Number);
      return {
        periode: `${BULAN_ID[bulanIdx] ?? bulanIdx} ${kunci.slice(0, 4)}`,
        persen: Math.round((e.hadir / e.total) * 1000) / 10,
      };
    });

  // Mahasiswa berisiko (global) — akumulasi lintas kelas per mahasiswa
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

  // Data ekspor
  const csvKelas: (string | number | null)[][] = [
    ["Kode", "Mata kuliah", "Kelas", "Dosen", "Mahasiswa", "Pertemuan", "Kehadiran rata-rata (%)", "Di bawah 75%"],
    ...perKelas.map((k) => [
      k.kelas.mataKuliah.kode,
      k.kelas.mataKuliah.nama,
      k.kelas.kodeKelas,
      k.kelas.dosen.nama,
      k.kelas.krs.length,
      k.totalPertemuan,
      k.rata,
      k.diBawah,
    ]),
  ];

  const nilaiByKelasMhs = new Map<string, { akhir: number | null; grade: string | null }>();
  for (const n of nilaiRows) nilaiByKelasMhs.set(`${n.kelasId}:${n.mahasiswaId}`, { akhir: n.akhir, grade: n.grade });

  const csvMhs: (string | number | null)[][] = [
    ["Kode", "Mata kuliah", "Kelas", "Dosen", "NIM", "Nama mahasiswa", "Hadir", "Sakit", "Izin", "Alpha", "Kehadiran (%)", "Memenuhi 75%", "Nilai akhir", "Grade"],
  ];
  for (const k of perKelas) {
    for (const r of k.kelas.krs) {
      const h = k.totalPertemuan;
      const e = hitunganKelas(rincian, k.kelas.id, r.mahasiswa.id);
      const stat = statistikKehadiran(h, e.hadir);
      const n = nilaiByKelasMhs.get(`${k.kelas.id}:${r.mahasiswa.id}`);
      csvMhs.push([
        k.kelas.mataKuliah.kode,
        k.kelas.mataKuliah.nama,
        k.kelas.kodeKelas,
        k.kelas.dosen.nama,
        r.mahasiswa.nim,
        r.mahasiswa.nama,
        e.hadir,
        e.sakit,
        e.izin,
        e.alpha,
        stat.persen,
        stat.memenuhi ? "Ya" : "Tidak",
        n?.akhir ?? null,
        n?.grade ?? null,
      ]);
    }
  }

  return (
    <>
      <PageHeader
        judul="Laporan Akademik"
        deskripsi={
          semesterAktif
            ? `Ringkasan kehadiran, nilai, dan tren akademik ${semesterAktif.nama} ${semesterAktif.tahun.nama}.`
            : "Ringkasan akademik semester berjalan."
        }
        aksi={
          <div className="flex flex-wrap gap-2">
            <TombolCSV
              filename="rekap-kelas.csv"
              baris={csvKelas}
              label="Unduh rekap kelas"
              ikon={<FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
            />
            <TombolCSV filename="rekap-mahasiswa.csv" baris={csvMhs} label="Unduh rekap mahasiswa" />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Kelas aktif"
          value={perKelas.length}
          sub="kelas semester ini"
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Kehadiran rata-rata"
          value={`${rataProdi}%`}
          sub={rataProdi >= 75 ? "memenuhi syarat" : "di bawah 75%"}
          ikon={<Activity className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Nilai akhir rata-rata"
          value={rataNilai ?? "—"}
          sub="seluruh kelas"
          ikon={<Award className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mahasiswa berisiko"
          value={jumlahBerisiko}
          sub="kehadiran < 75%"
          ikon={<AlertTriangle className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kehadiran per mata kuliah</CardTitle>
            <p className="text-xs text-fg-muted">Batang kuning menandakan rata-rata di bawah 75%.</p>
          </CardHeader>
          <CardContent>
            {dataKehadiran.length === 0 ? (
              <EmptyState compact judul="Belum ada data" deskripsi="Belum ada kelas aktif pada semester ini." />
            ) : (
              <GrafikKehadiran data={dataKehadiran} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tren kehadiran per bulan</CardTitle>
            <p className="text-xs text-fg-muted">Berdasarkan absensi yang tercatat tiap bulan.</p>
          </CardHeader>
          <CardContent>
            {dataTren.length === 0 ? (
              <EmptyState compact judul="Belum ada data" deskripsi="Belum ada catatan absensi." />
            ) : (
              <GrafikTrenKehadiran data={dataTren} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Distribusi nilai</CardTitle>
          <p className="text-xs text-fg-muted">Jumlah mahasiswa per grade di semua kelas aktif.</p>
        </CardHeader>
        <CardContent>
          <GrafikDistribusiNilai data={dataDistribusi} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Rekap per kelas</CardTitle>
          <p className="text-xs text-fg-muted">
            Dasar laporan; detail tiap mahasiswa tersedia pada berkas CSV.
          </p>
        </CardHeader>
        <CardContent>
          {perKelas.length === 0 ? (
            <EmptyState icon={BookOpen} judul="Belum ada kelas" deskripsi="Belum ada kelas aktif pada semester ini." />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Kode</TableHead>
                    <TableHead>Mata kuliah</TableHead>
                    <TableHead>Dosen</TableHead>
                    <TableHead className="w-20 text-right">Mahasiswa</TableHead>
                    <TableHead className="w-20 text-right">Pertemuan</TableHead>
                    <TableHead className="w-36">Rata-rata</TableHead>
                    <TableHead className="w-24 text-center">Under 75%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perKelas.map(({ kelas, totalPertemuan, rata, diBawah }) => (
                    <TableRow key={kelas.id}>
                      <TableCell>
                        <Num className="text-fg-muted">{kelas.mataKuliah.kode}</Num>
                      </TableCell>
                      <TableCell>
                        <span className="block font-medium text-fg">{kelas.mataKuliah.nama}</span>
                        <span className="text-2xs text-fg-subtle">Kelas {kelas.kodeKelas}</span>
                      </TableCell>
                      <TableCell className="text-fg-muted">{kelas.dosen.nama}</TableCell>
                      <TableCell className="text-right">
                        <Num className="text-fg">{kelas.krs.length}</Num>
                      </TableCell>
                      <TableCell className="text-right">
                        <Num className="text-fg-muted">{totalPertemuan}</Num>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={rata}
                            tone={rata >= 75 ? "success" : "warning"}
                            label={`Rata-rata kehadiran ${kelas.mataKuliah.nama}`}
                            className="w-24"
                          />
                          <span className="font-mono-nums text-xs text-fg-muted">{rata}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={diBawah > 0 ? "warning" : "success"}>{diBawah} mhs</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}