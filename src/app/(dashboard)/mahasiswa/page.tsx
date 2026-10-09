import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser, ambilNama } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheSemesterAktif } from "@/lib/cache";
import { statistikKehadiran, hitungIpk } from "@/lib/grade";
import { StatCard } from "@/components/shared/page-header";
import { DashboardHero } from "@/components/shared/dashboard-hero";
import { GrafikKehadiran } from "@/components/charts/grafik";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  Num,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/form-extras";
import {
  QrCode,
  ClipboardList,
  CalendarDays,
  GraduationCap,
  ArrowRight,
  MapPin,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard Mahasiswa" };

export default async function DashboardMahasiswa() {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") redirect("/login");

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
  });
  if (!mahasiswa) redirect("/login");

  const semesterAktif = await cacheSemesterAktif();

  // ── Kehadiran per kelas semester aktif ─────────────────────────
  const kelasDiambil = semesterAktif
    ? await prisma.kRS.findMany({
        where: { mahasiswaId: mahasiswa.id, status: "diambil", kelas: { semesterId: semesterAktif.id } },
        include: {
          kelas: {
            include: {
              mataKuliah: true,
              dosen: true,
              jadwal: true,
              pertemuan: { orderBy: { nomor: "asc" } },
            },
          },
        },
      })
    : [];

  const kelasIds = kelasDiambil.map((k) => k.kelasId);

  // Satu query groupBy untuk semua kelas (dulu 1 count per kelas = N+1).
  const hadirPerKelas = new Map<string, number>();
  if (kelasIds.length) {
    const petaPertemuan = new Map<string, string>();
    for (const k of kelasDiambil) {
      for (const p of k.kelas.pertemuan) petaPertemuan.set(p.id, k.kelas.id);
    }
    const barisHadir = await prisma.absensi.groupBy({
      by: ["pertemuanId"],
      where: {
        mahasiswaId: mahasiswa.id,
        status: "hadir",
        pertemuan: { kelasId: { in: kelasIds } },
      },
      _count: { _all: true },
    });
    for (const b of barisHadir) {
      const kelasId = petaPertemuan.get(b.pertemuanId);
      if (!kelasId) continue;
      hadirPerKelas.set(kelasId, (hadirPerKelas.get(kelasId) ?? 0) + b._count._all);
    }
  }

  const daftarKehadiran = kelasDiambil.map((k) => {
    const total = k.kelas.pertemuan.length;
    const hadir = hadirPerKelas.get(k.kelas.id) ?? 0;
    return {
      kelas: k.kelas,
      stat: statistikKehadiran(total, hadir),
      hadir,
      total,
    };
  });

  const totalPertemuan = daftarKehadiran.reduce((a, d) => a + d.total, 0);
  const totalHadir = daftarKehadiran.reduce((a, d) => a + d.hadir, 0);
  const kehadiranSemester = statistikKehadiran(totalPertemuan, totalHadir);

  // ── IPK dari seluruh nilai yang sudah lulus ────────────────────
  const semuaNilai = await prisma.nilai.findMany({
    where: { mahasiswaId: mahasiswa.id, akhir: { not: null } },
    include: { kelas: { include: { mataKuliah: true } } },
  });
  const ipk = hitungIpk(
    semuaNilai.map((n) => ({ akhir: n.akhir, sks: n.kelas.mataKuliah.sks }))
  );
  const totalSks = semuaNilai.reduce((a, n) => a + n.kelas.mataKuliah.sks, 0);

  // ── Tugas deadline terdekat (belum dikumpul) ───────────────────
  const tugas = await prisma.tugas.findMany({
    where: {
      kelasId: { in: kelasIds },
      publishedAt: { not: null },
      deadlineAt: { gte: new Date() },
      deletedAt: null,
      submission: { none: { mahasiswaId: mahasiswa.id } },
    },
    include: { kelas: { include: { mataKuliah: true } } },
    orderBy: { deadlineAt: "asc" },
    take: 5,
  });

  // ── Jadwal hari ini ────────────────────────────────────────────
  const hariIni = new Date();
  const namaHari = format(hariIni, "EEEE", { locale: localeId }) as
    | "Senin"
    | "Selasa"
    | "Rabu"
    | "Kamis"
    | "Jumat"
    | "Sabtu";
  const jadwalHariIni = kelasDiambil
    .flatMap((k) =>
      k.kelas.jadwal
        .filter((j) => j.hari === namaHari)
        .map((j) => ({ jadwal: j, kelas: k.kelas }))
    )
    .sort((a, b) => a.jadwal.jamMulai.localeCompare(b.jadwal.jamMulai));

  // ── Notifikasi terbaru ─────────────────────────────────────────
  const notifikasi = await prisma.notifikasi.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  const grafikData = daftarKehadiran.map((d) => ({
    nama: d.kelas.mataKuliah.nama,
    persen: d.stat.persen,
    memenuhi: d.stat.memenuhi,
  }));

  const nama = await ambilNama({ id: user.userId, role: user.role });

  return (
    <>
      <DashboardHero
        label="Mahasiswa"
        judul={`Halo, ${nama.split(" ")[0]}`}
        deskripsi={`${mahasiswa.nim} · Semester ${
          semesterAktif
            ? `${semesterAktif.nama} ${semesterAktif.tahun.nama}`
            : "—"
        } · ${format(hariIni, "EEEE, d MMMM yyyy", { locale: localeId })}`}
        ikon={<QrCode className="h-5 w-5" strokeWidth={1.5} aria-hidden />}
        aksi={
          <Button asChild>
            <Link href="/mahasiswa/absensi">
              <QrCode className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Absen sekarang
            </Link>
          </Button>
        }
      />

      {/* Baris statistik */}
      <div className="stagger-rise grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Kehadiran semester ini"
          value={`${kehadiranSemester.persen}%`}
          sub={
            kehadiranSemester.memenuhi
              ? `syarat 75% terpenuhi`
              : `butuh ${kehadiranSemester.butuhHadir}× hadir lagi`
          }
          ikon={<QrCode className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="IPK sementara"
          value={ipk.toFixed(2)}
          sub={`${totalSks} SKS tercatat`}
          ikon={<GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Tugas belum dikumpul"
          value={tugas.length}
          sub={
            tugas.length > 0
              ? `terdekat ${format(tugas[0].deadlineAt, "d MMM", { locale: localeId })}`
              : "semua beres"
          }
          ikon={<ClipboardList className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Kelas hari ini"
          value={jadwalHariIni.length}
          sub={
            jadwalHariIni.length > 0
              ? jadwalHariIni[0].jadwal.jamMulai
              : "tidak ada kelas"
          }
          ikon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      {/* Grid utama: 12 kolom */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Kehadiran per mata kuliah — 8 kolom */}
        <Card className="lg:col-span-8">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Kehadiran per mata kuliah</CardTitle>
              <p className="text-xs text-fg-muted">
                Batas minimum kelulusan: 75% dari total pertemuan
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/mahasiswa/absensi">
                Riwayat lengkap
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {grafikData.length === 0 ? (
              <EmptyState
                compact
                judul="Belum ada kelas diambil"
                deskripsi="Ambil mata kuliah pada periode KRS untuk melihat statistik kehadiran."
              />
            ) : (
              <GrafikKehadiran data={grafikData} />
            )}
          </CardContent>
        </Card>

        {/* Jadwal hari ini — 4 kolom */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Jadwal hari ini</CardTitle>
            <p className="text-xs text-fg-muted">
              {format(hariIni, "EEEE, d MMMM", { locale: localeId })}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {jadwalHariIni.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarDays}
                judul="Tidak ada kelas hari ini"
                deskripsi="Manfaatkan waktu untuk mengerjakan tugas."
              />
            ) : (
              jadwalHariIni.map((j) => (
                <div
                  key={j.jadwal.id}
                  className="flex items-start gap-3 rounded border border-border bg-surface p-3"
                >
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
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                      <MapPin className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                      {j.jadwal.ruang} · {j.kelas.dosen.gelar ?? ""}{" "}
                      {j.kelas.dosen.nama}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Tugas terdekat — 7 kolom */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Tugas deadline terdekat</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/mahasiswa/tugas">
                Semua tugas
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tugas.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                judul="Tidak ada tugas tertunda"
                deskripsi="Semua tugas untuk kelas yang Anda ambil sudah dikumpulkan."
              />
            ) : (
              <div className="overflow-hidden rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tugas</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead className="text-right">Deadline</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tugas.map((t) => {
                      const sisaJam = Math.max(
                        0,
                        Math.floor(
                          (t.deadlineAt.getTime() - Date.now()) / 3_600_000
                        )
                      );
                      const mendesak = sisaJam < 24;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-fg">
                            {t.judul}
                          </TableCell>
                          <TableCell className="text-fg-muted">
                            {t.kelas.mataKuliah.nama}
                          </TableCell>
                          <Num className="text-fg-muted">
                            {format(t.deadlineAt, "d MMM HH:mm", {
                              locale: localeId,
                            })}
                          </Num>
                          <Num>
                            <Badge variant={mendesak ? "danger" : "neutral"}>
                              {sisaJam < 1
                                ? "<1 jam"
                                : sisaJam < 24
                                  ? `${sisaJam} jam`
                                  : `${Math.floor(sisaJam / 24)} hari`}
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

        {/* Notifikasi — 5 kolom */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Notifikasi terbaru</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {notifikasi.length === 0 ? (
              <EmptyState
                compact
                judul="Belum ada notifikasi"
                deskripsi="Info tugas, absensi, dan nilai akan muncul di sini."
              />
            ) : (
              notifikasi.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5">
                  <StatusDot
                    tone={
                      n.tipe === "nilai"
                        ? "success"
                        : n.tipe === "absensi"
                          ? "info"
                          : n.tipe === "tugas"
                            ? "warning"
                            : "neutral"
                    }
                    className="mt-1.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{n.judul}</p>
                    <p className="text-xs text-fg-muted">{n.pesan}</p>
                    <p className="mt-0.5 font-mono-nums text-2xs text-fg-subtle">
                      {format(n.createdAt, "d MMM HH:mm", { locale: localeId })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progres kehadiran detail */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Detail kehadiran per kelas</CardTitle>
        </CardHeader>
        <CardContent>
          {daftarKehadiran.length === 0 ? (
            <EmptyState
              compact
              judul="Belum ada data kehadiran"
              deskripsi="Kehadiran akan tercatat setelah dosen membuka sesi absensi."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {daftarKehadiran.map((d) => (
                <div
                  key={d.kelas.id}
                  className="rounded border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {d.kelas.mataKuliah.nama}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {d.kelas.mataKuliah.sks} SKS · Kelas {d.kelas.kodeKelas} ·{" "}
                        {d.kelas.dosen.nama}
                      </p>
                    </div>
                    <Badge variant={d.stat.memenuhi ? "success" : "warning"}>
                      {d.stat.persen}%
                    </Badge>
                  </div>
                  <Progress
                    value={d.stat.persen}
                    tone={d.stat.memenuhi ? "success" : "warning"}
                    label={`Kehadiran ${d.kelas.mataKuliah.nama}`}
                    className="mt-3"
                  />
                  <p className="mt-2 font-mono-nums text-2xs text-fg-subtle">
                    {d.hadir}/{d.total} pertemuan
                    {!d.stat.memenuhi && d.stat.butuhHadir > 0 && (
                      <span className="text-warning-text">
                        {" "}
                        · butuh {d.stat.butuhHadir}× hadir lagi
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
