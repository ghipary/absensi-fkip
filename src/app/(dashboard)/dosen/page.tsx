import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser, ambilNama } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheSemesterAktif } from "@/lib/cache";
import { statistikKehadiran } from "@/lib/grade";
import { StatCard } from "@/components/shared/page-header";
import { DashboardHero } from "@/components/shared/dashboard-hero";
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
import { QrCode, ClipboardList, UsersRound, ArrowRight, CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard Dosen" };

export default async function DashboardDosen() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    redirect("/login");
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) redirect("/login");

  const semesterAktif = await cacheSemesterAktif();

  // Kelas yang diampu semester ini
  const kelas = semesterAktif
    ? await prisma.kelas.findMany({
        where: { dosenId: dosen.id, semesterId: semesterAktif.id, deletedAt: null },
        include: {
          mataKuliah: true,
          jadwal: true,
          krs: { where: { status: "diambil" } },
          pertemuan: { orderBy: { nomor: "asc" } },
        },
      })
    : [];

  const kelasIds = kelas.map((k) => k.id);

  // ── Jadwal hari ini ────────────────────────────────────────────
  const hariIni = new Date();
  const namaHari = format(hariIni, "EEEE", { locale: localeId }) as
    | "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";
  const kelasHariIni = kelas
    .flatMap((k) =>
      k.jadwal.filter((j) => j.hari === namaHari).map((j) => ({ jadwal: j, kelas: k }))
    )
    .sort((a, b) => a.jadwal.jamMulai.localeCompare(b.jadwal.jamMulai));

  // ── Pertemuan berikutnya per kelas (belum ada absensi) ─────────
  const pertemuanTerbuka = kelasIds.length
    ? await prisma.pertemuan.findMany({
        where: {
          kelasId: { in: kelasIds },
          isLocked: false,
          tanggal: { gte: new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate()) },
          absensi: { none: {} },
        },
        include: { kelas: { include: { mataKuliah: true, jadwal: true } } },
        orderBy: [{ tanggal: "asc" }, { nomor: "asc" }],
        take: 5,
      })
    : [];

  // ── Submission belum dinilai ───────────────────────────────────
  const belumDinilai = await prisma.submission.count({
    where: { nilai: null, tugas: { kelasId: { in: kelasIds }, deletedAt: null } },
  });

  // Total mahasiswa aktif di kelas yang diampu
  const totalMahasiswa = await prisma.kRS.count({
    where: { kelasId: { in: kelasIds }, status: "diambil" },
  });

  // ── Kehadiran rata-rata kelas ──────────────────────────────────
  // Satu query groupBy untuk semua kelas (dulu 1 count per kelas = N+1).
  const hadirPerKelas = new Map<string, number>();
  if (kelasIds.length) {
    const petaPertemuan = new Map<string, string>();
    for (const k of kelas) {
      for (const p of k.pertemuan) petaPertemuan.set(p.id, k.id);
    }
    const barisHadir = await prisma.absensi.groupBy({
      by: ["pertemuanId"],
      where: { status: "hadir", pertemuan: { kelasId: { in: kelasIds } } },
      _count: { _all: true },
    });
    for (const b of barisHadir) {
      const kelasId = petaPertemuan.get(b.pertemuanId);
      if (!kelasId) continue;
      hadirPerKelas.set(kelasId, (hadirPerKelas.get(kelasId) ?? 0) + b._count._all);
    }
  }

  const rekapKelas = kelas.map((k) => {
    const total = k.pertemuan.length;
    const hadir = hadirPerKelas.get(k.id) ?? 0;
    const perPertemuan = k.krs.length * Math.max(total, 1);
    return {
      kelas: k,
      persen: perPertemuan === 0 ? 0 : Math.round((hadir / perPertemuan) * 1000) / 10,
      jumlahMhs: k.krs.length,
      total,
    };
  });

  const nama = await ambilNama({ id: user.userId, role: user.role });

  return (
    <>
      <DashboardHero
        label="Dosen"
        judul={`Halo, ${dosen.nama.split(" ")[0]}`}
        deskripsi={`${dosen.gelar ?? ""} ${dosen.nama} · ${
          kelas.length
        } kelas diampu · ${format(hariIni, "EEEE, d MMMM yyyy", { locale: localeId })}`}
        ikon={<QrCode className="h-5 w-5" strokeWidth={1.5} aria-hidden />}
        aksi={
          <Button asChild>
            <Link href="/dosen/absensi">
              <QrCode className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Buka sesi absensi
            </Link>
          </Button>
        }
      />

      <div className="stagger-rise grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Kelas hari ini"
          value={kelasHariIni.length}
          sub={
            kelasHariIni.length > 0
              ? `${kelasHariIni[0].jadwal.jamMulai} · ${kelasHariIni[0].kelas.mataKuliah.nama}`
              : "hari libur"
          }
          ikon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Tugas perlu dinilai"
          value={belumDinilai}
          sub={belumDinilai > 0 ? "menunggu penilaian" : "semua beres"}
          ikon={<ClipboardList className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mahasiswa diajar"
          value={totalMahasiswa}
          sub={`di ${kelas.length} kelas`}
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Rata-rata kehadiran"
          value={`${
            rekapKelas.length
              ? Math.round(
                  (rekapKelas.reduce((a, r) => a + r.persen, 0) /
                    rekapKelas.length) *
                    10
                ) / 10
              : 0
          }%`}
          sub="seluruh kelas"
          ikon={<QrCode className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Jadwal hari ini — 5 kolom */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Jadwal mengajar hari ini</CardTitle>
            <p className="text-xs text-fg-muted">
              {format(hariIni, "EEEE, d MMMM yyyy", { locale: localeId })}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {kelasHariIni.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarDays}
                judul="Tidak ada kelas hari ini"
                deskripsi="Periksa jadwal mengajar Anda untuk hari lain."
              />
            ) : (
              kelasHariIni.map((j) => (
                <div
                  key={j.jadwal.id}
                  className="flex items-center justify-between gap-3 rounded border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 rounded border border-accent-border bg-accent-subtle px-2 py-1 text-center">
                      <p className="font-mono-nums text-2xs font-semibold leading-tight text-accent">
                        {j.jadwal.jamMulai}
                      </p>
                      <p className="font-mono-nums text-2xs leading-tight text-accent/70">
                        {j.jadwal.jamSelesai}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {j.kelas.mataKuliah.nama}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {j.jadwal.ruang} · Kelas {j.kelas.kodeKelas} ·{" "}
                        {j.kelas.krs.length} mahasiswa
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/dosen/absensi?kelas=${j.kelas.id}`}>
                      <QrCode className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                      Absen
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Pertemuan perlu dibuka absensi — 7 kolom */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Pertemuan belum tercatat absensinya</CardTitle>
            <p className="text-xs text-fg-muted">
              Buka sesi absensi agar kehadiran mahasiswa tercatat
            </p>
          </CardHeader>
          <CardContent>
            {pertemuanTerbuka.length === 0 ? (
              <EmptyState
                compact
                icon={QrCode}
                judul="Semua pertemuan sudah tercatat"
                deskripsi="Tidak ada pertemuan yang menunggu pembukaan sesi absensi."
              />
            ) : (
              <div className="overflow-hidden rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Pert.</TableHead>
                      <TableHead>Mata kuliah</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Ruang</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pertemuanTerbuka.map((p) => (
                      <TableRow key={p.id}>
                        <Num className="text-fg-muted">{p.nomor}</Num>
                        <TableCell className="font-medium text-fg">
                          {p.kelas.mataKuliah.nama}
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {format(p.tanggal, "d MMM yyyy", { locale: localeId })}
                        </TableCell>
                        <TableCell className="text-fg-muted">
                          {p.kelas.jadwal[0]?.ruang ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" asChild>
                            <Link href={`/dosen/absensi?kelas=${p.kelasId}&pertemuan=${p.id}`}>
                              Buka sesi
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rekap kehadiran kelas */}
        <Card className="lg:col-span-12">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Statistik kehadiran kelas yang diampu</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dosen/rekap">
                Rekap lengkap
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {rekapKelas.length === 0 ? (
              <EmptyState
                compact
                judul="Belum ada kelas semester ini"
                deskripsi="Kelas akan muncul setelah kaprodi mengampukan Anda ke mata kuliah."
              />
            ) : (
              <div className="overflow-hidden rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Mata kuliah</TableHead>
                      <TableHead className="text-right">SKS</TableHead>
                      <TableHead className="text-right">Mahasiswa</TableHead>
                      <TableHead className="text-right">Pertemuan</TableHead>
                      <TableHead className="text-right">Kehadiran</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rekapKelas.map((r) => (
                      <TableRow key={r.kelas.id}>
                        <TableCell className="font-mono-nums text-xs text-fg-muted">
                          {r.kelas.mataKuliah.kode}
                        </TableCell>
                        <TableCell className="font-medium text-fg">
                          {r.kelas.mataKuliah.nama}
                        </TableCell>
                        <Num className="text-fg-muted">
                          {r.kelas.mataKuliah.sks}
                        </Num>
                        <Num className="text-fg-muted">{r.jumlahMhs}</Num>
                        <Num className="text-fg-muted">{r.total}</Num>
                        <Num>{r.persen}%</Num>
                        <Num>
                          <Badge variant={r.persen >= 75 ? "success" : "warning"}>
                            {r.persen >= 75 ? "Aman" : "Waspada"}
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
      </div>
    </>
  );
}
