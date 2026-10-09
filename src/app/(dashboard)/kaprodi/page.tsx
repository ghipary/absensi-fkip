import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheSemesterAktif } from "@/lib/cache";
import { StatCard } from "@/components/shared/page-header";
import { DashboardHero } from "@/components/shared/dashboard-hero";
import { GrafikDistribusiNilai, GrafikTrenKehadiran } from "@/components/charts/grafik";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  UsersRound,
  GraduationCap,
  BookOpen,
  Layers,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard Kaprodi" };

export default async function DashboardKaprodi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const semesterAktif = await cacheSemesterAktif();

  // ── Angka utama ────────────────────────────────────────────────
  const [jumlahMhs, jumlahDosen, jumlahMK, jumlahKelas] = await Promise.all([
    prisma.mahasiswa.count({ where: { status: "aktif" } }),
    prisma.dosen.count({ where: { status: "aktif" } }),
    prisma.mataKuliah.count({ where: { deletedAt: null } }),
    prisma.kelas.count({
      where: { semesterId: semesterAktif?.id ?? "—", deletedAt: null },
    }),
  ]);

  // ── Distribusi nilai (seluruh nilai yang sudah dihitung) ───────
  const semuaNilai = await prisma.nilai.findMany({
    where: { akhir: { not: null } },
    select: { grade: true },
  });
  const distribusi = (["A", "B", "C", "D", "E"] as const).map((g) => ({
    grade: g,
    jumlah: semuaNilai.filter((n) => n.grade === g).length,
  }));

  // ── Tren kehadiran prodi per bulan (6 bulan terakhir) ──────────
  // Satu query + bucket di memori (dulu 12 count terpisah = N+1).
  const bulanIni = new Date();
  const bulanAwal = subMonths(bulanIni, 5);
  const awalRentang = new Date(bulanAwal.getFullYear(), bulanAwal.getMonth(), 1);
  const absenRentang = await prisma.absensi.findMany({
    where: { checkInAt: { gte: awalRentang } },
    select: { checkInAt: true, status: true },
  });
  const bucket = new Map<string, { hadir: number; total: number }>();
  for (const a of absenRentang) {
    const key = `${a.checkInAt.getFullYear()}-${a.checkInAt.getMonth()}`;
    const cur = bucket.get(key) ?? { hadir: 0, total: 0 };
    cur.total++;
    if (a.status === "hadir") cur.hadir++;
    bucket.set(key, cur);
  }
  const tren = Array.from({ length: 6 }, (_, i) => {
    const bulan = subMonths(bulanIni, 5 - i);
    const b = bucket.get(`${bulan.getFullYear()}-${bulan.getMonth()}`) ?? {
      hadir: 0,
      total: 0,
    };
    return {
      periode: format(bulan, "MMM", { locale: localeId }),
      persen: b.total === 0 ? 0 : Math.round((b.hadir / b.total) * 1000) / 10,
    };
  });

  // ── Alert: mahasiswa < 75% semester ini ────────────────────────
  const kelasSemester = semesterAktif
    ? await prisma.kelas.findMany({
        where: { semesterId: semesterAktif.id, deletedAt: null },
        select: { id: true, dosenId: true, krs: { where: { status: "diambil" }, select: { mahasiswaId: true } } },
      })
    : [];

  const alertMhs = new Map<
    string,
    { nim: string; nama: string; persen: number; kelas: string; butuh: number }
  >();

  if (kelasSemester.length > 0) {
    const pertemuanPerKelas = await prisma.pertemuan.groupBy({
      by: ["kelasId"],
      where: { kelas: { semesterId: semesterAktif?.id } },
      _count: true,
    });
    const hitungPertemuan = new Map(
      pertemuanPerKelas.map((p) => [p.kelasId, p._count])
    );

    const absensiPerKelas = await prisma.absensi.groupBy({
      by: ["mahasiswaId", "pertemuanId"],
      where: {
        status: "hadir",
        pertemuan: { kelas: { semesterId: semesterAktif?.id } },
      },
      _count: true,
    });

    // Hitung per mahasiswa: total pertemuan di semua kelasnya vs yang dihadiri
    const perMhs = new Map<string, { hadir: number; total: number }>();
    for (const k of kelasSemester) {
      const totalP = hitungPertemuan.get(k.id) ?? 0;
      for (const krs of k.krs) {
        const cur = perMhs.get(krs.mahasiswaId) ?? { hadir: 0, total: 0 };
        cur.total += totalP;
        perMhs.set(krs.mahasiswaId, cur);
      }
    }
    for (const a of absensiPerKelas) {
      const cur = perMhs.get(a.mahasiswaId);
      if (cur) cur.hadir += a._count;
    }

    const daftarId = [...perMhs.entries()]
      .filter(([, v]) => v.total >= 4 && v.hadir / v.total < 0.75)
      .sort((a, b) => a[1].hadir / a[1].total - b[1].hadir / b[1].total)
      .slice(0, 8)
      .map(([id]) => id);

    if (daftarId.length) {
      const mhsList = await prisma.mahasiswa.findMany({
        where: { id: { in: daftarId } },
        select: { id: true, nim: true, nama: true },
      });
      for (const m of mhsList) {
        const v = perMhs.get(m.id)!;
        const persen = Math.round((v.hadir / v.total) * 1000) / 10;
        alertMhs.set(m.id, {
          nim: m.nim,
          nama: m.nama,
          persen,
          kelas: `${v.hadir}/${v.total} pertemuan`,
          butuh: Math.max(0, Math.ceil(v.total * 0.75) - v.hadir),
        });
      }
    }
  }

  // ── Alert: dosen belum input nilai (kelas aktif, UTS/UAS kosong) ─
  const kelasTanpaNilai = semesterAktif
    ? await prisma.kelas.findMany({
        where: {
          semesterId: semesterAktif.id,
          deletedAt: null,
          nilai: { none: { uts: { not: null } } },
          pertemuan: { some: {} },
        },
        include: {
          mataKuliah: true,
          dosen: true,
          _count: { select: { nilai: true, krs: { where: { status: "diambil" } } } },
        },
        take: 6,
      })
    : [];

  // ── Monitoring kelengkapan dosen ───────────────────────────────
  const rekapDosen = await prisma.dosen.findMany({
    where: { status: "aktif", kelasDiampu: { some: { semesterId: semesterAktif?.id } } },
    include: {
      kelasDiampu: {
        where: { semesterId: semesterAktif?.id, deletedAt: null },
        include: {
          mataKuliah: true,
          _count: { select: { krs: { where: { status: "diambil" } }, pertemuan: true } },
        },
      },
    },
    orderBy: { nama: "asc" },
  });

  const alertList = [...alertMhs.values()];

  return (
    <>
      <DashboardHero
        label="Kaprodi"
        judul="Dashboard Eksekutif"
        deskripsi={`Program Studi Pendidikan Matematika · Semester ${
          semesterAktif
            ? `${semesterAktif.nama} ${semesterAktif.tahun.nama}`
            : "belum aktif"
        } · Per ${format(new Date(), "d MMMM yyyy", { locale: localeId })}`}
        ikon={<GraduationCap className="h-5 w-5" strokeWidth={1.5} aria-hidden />}
        aksi={
          <Button asChild>
            <Link href="/kaprodi/laporan">
              Statistik & laporan
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* Angka utama */}
      <div className="stagger-rise grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Mahasiswa aktif"
          value={jumlahMhs}
          sub="terdaftar di prodi"
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
          href="/kaprodi/manajemen"
        />
        <StatCard
          label="Dosen aktif"
          value={jumlahDosen}
          sub="tetap & pengampu"
          ikon={<GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
          href="/kaprodi/dosen"
        />
        <StatCard
          label="Mata kuliah"
          value={jumlahMK}
          sub="katalog prodi"
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
          href="/kaprodi/manajemen"
        />
        <StatCard
          label="Kelas berjalan"
          value={jumlahKelas}
          sub="semester ini"
          ikon={<Layers className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      {/* Grafik */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Tren kehadiran prodi</CardTitle>
            <p className="text-xs text-fg-muted">
              Persentase hadir dari seluruh catatan absensi per bulan
            </p>
          </CardHeader>
          <CardContent>
            <GrafikTrenKehadiran data={tren} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Distribusi nilai</CardTitle>
            <p className="text-xs text-fg-muted">
              Seluruh mata kuliah yang sudah memiliki nilai akhir
            </p>
          </CardHeader>
          <CardContent>
            {semuaNilai.length === 0 ? (
              <EmptyState
                compact
                judul="Belum ada nilai akhir"
                deskripsi="Distribusi muncul setelah dosen menyelesaikan input nilai."
              />
            ) : (
              <GrafikDistribusiNilai data={distribusi} />
            )}
          </CardContent>
        </Card>

        {/* Alert kehadiran */}
        <Card className="lg:col-span-5 border-warning-border">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-text" strokeWidth={1.5} aria-hidden />
              <CardTitle>Kehadiran di bawah 75%</CardTitle>
            </div>
            <Badge variant={alertList.length ? "warning" : "success"}>
              {alertList.length} mahasiswa
            </Badge>
          </CardHeader>
          <CardContent>
            {alertList.length === 0 ? (
              <EmptyState
                compact
                judul="Semua mahasiswa aman"
                deskripsi="Tidak ada mahasiswa dengan kehadiran di bawah syarat 75%."
              />
            ) : (
              <div className="overflow-hidden rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIM</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead className="text-right">Hadir</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertList.map((a) => (
                      <TableRow key={a.nim}>
                        <TableCell className="font-mono-nums text-xs text-fg-muted">
                          {a.nim}
                        </TableCell>
                        <TableCell className="font-medium text-fg">
                          {a.nama}
                        </TableCell>
                        <Num className="text-fg-subtle">{a.kelas}</Num>
                        <Num>
                          <Badge variant={a.persen < 60 ? "danger" : "warning"}>
                            {a.persen}%
                          </Badge>
                        </Num>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alert dosen belum input nilai */}
        <Card className="lg:col-span-7 border-danger-border">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-danger-text" strokeWidth={1.5} aria-hidden />
              <CardTitle>Dosen belum input nilai UTS/UAS</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kaprodi/validasi">
                Validasi data
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {kelasTanpaNilai.length === 0 ? (
              <EmptyState
                compact
                judul="Semua nilai sudah masuk"
                deskripsi="Seluruh kelas semester ini memiliki nilai UTS tercatat."
              />
            ) : (
              <div className="overflow-hidden rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mata kuliah</TableHead>
                      <TableHead>Dosen</TableHead>
                      <TableHead className="text-right">Mahasiswa</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kelasTanpaNilai.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium text-fg">
                          {k.mataKuliah.nama}{" "}
                          <span className="font-mono-nums text-xs text-fg-subtle">
                            ({k.mataKuliah.kode})
                          </span>
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {k.dosen.nama}
                        </TableCell>
                        <Num className="text-fg-muted">{k._count.krs}</Num>
                        <Num>
                          <Badge variant="danger">belum input</Badge>
                        </Num>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monitoring dosen ringkas */}
        <Card className="lg:col-span-12">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Beban mengajar & kelengkapan dosen</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/kaprodi/dosen">
                Monitoring lengkap
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {rekapDosen.length === 0 ? (
              <EmptyState
                compact
                judul="Belum ada dosen mengampu"
                deskripsi="Assign dosen ke mata kuliah pada menu Manajemen."
              />
            ) : (
              <div className="overflow-hidden rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NIP</TableHead>
                      <TableHead>Nama dosen</TableHead>
                      <TableHead>Bidang studi</TableHead>
                      <TableHead className="text-right">Kelas</TableHead>
                      <TableHead className="text-right">SKS</TableHead>
                      <TableHead className="text-right">Mahasiswa</TableHead>
                      <TableHead className="text-right">Kelas diampu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapDosen.map((d) => {
                      const totalSks = d.kelasDiampu.reduce(
                        (a, k) => a + k.mataKuliah.sks,
                        0
                      );
                      const totalMhs = d.kelasDiampu.reduce(
                        (a, k) => a + k._count.krs,
                        0
                      );
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono-nums text-xs text-fg-muted">
                            {d.nip}
                          </TableCell>
                          <TableCell className="font-medium text-fg">
                            {d.gelar ?? ""} {d.nama}
                          </TableCell>
                          <TableCell className="text-fg-muted">
                            {d.bidangStudi ?? "—"}
                          </TableCell>
                          <Num className="text-fg-muted">{d.kelasDiampu.length}</Num>
                          <Num>{totalSks}</Num>
                          <Num className="text-fg-muted">{totalMhs}</Num>
                          <Num>
                            <Badge variant={d.kelasDiampu.length > 0 ? "success" : "neutral"}>
                              {d.kelasDiampu.length > 0 ? "aktif" : "—"}
                            </Badge>
                          </Num>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
