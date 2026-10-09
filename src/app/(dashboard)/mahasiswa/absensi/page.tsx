import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheSemesterAktif } from "@/lib/cache";
import { statistikKehadiran } from "@/lib/grade";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Select, Progress } from "@/components/ui/form-extras";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Num,
} from "@/components/ui/table";
import { FormCheckin } from "./form-checkin";
import { TombolSurat } from "./tombol-surat";
import { QrCode, CalendarCheck, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Absensi" };

const TONE_STATUS = {
  hadir: "success",
  sakit: "info",
  izin: "info",
  alpha: "danger",
} as const;

export default async function HalamanAbsensiMahasiswa({
  searchParams,
}: {
  searchParams: { kelas?: string };
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") redirect("/login");

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
  });
  if (!mahasiswa) redirect("/login");

  const semesterAktif = await cacheSemesterAktif();

  const kelasDiambil = semesterAktif
    ? await prisma.kRS.findMany({
        where: {
          mahasiswaId: mahasiswa.id,
          status: "diambil",
          kelas: { semesterId: semesterAktif.id },
        },
        include: {
          kelas: {
            include: {
              mataKuliah: true,
              dosen: true,
              pertemuan: { orderBy: { nomor: "asc" } },
            },
          },
        },
        orderBy: { kelas: { mataKuliah: { kode: "asc" } } },
      })
    : [];

  const kelasTerpilih = kelasDiambil.find((k) => k.kelasId === searchParams.kelas);

  // Riwayat absensi (semua kelas, atau satu bila difilter)
  const riwayat = await prisma.absensi.findMany({
    where: {
      mahasiswaId: mahasiswa.id,
      pertemuan: kelasTerpilih
        ? { kelasId: kelasTerpilih.kelasId }
        : { kelas: { semesterId: semesterAktif?.id ?? "—" } },
    },
    include: {
      surat: { select: { id: true, status: true } },
      pertemuan: {
        include: { kelas: { include: { mataKuliah: true, dosen: true } } },
      },
    },
    orderBy: [{ pertemuan: { tanggal: "desc" } }, { pertemuan: { nomor: "desc" } }],
    take: 50,
  });

  // Statistik per kelas vs 75% — satu query groupBy (dulu 4 count per kelas = N+1).
  const kelasIds = kelasDiambil.map((k) => k.kelasId);
  const hitung = new Map<
    string,
    { hadir: number; sakit: number; izin: number; alpha: number }
  >();
  if (kelasIds.length) {
    const petaPertemuan = new Map<string, string>();
    for (const k of kelasDiambil) {
      for (const p of k.kelas.pertemuan) petaPertemuan.set(p.id, k.kelasId);
    }
    const barisAbsen = await prisma.absensi.groupBy({
      by: ["pertemuanId", "status"],
      where: {
        mahasiswaId: mahasiswa.id,
        pertemuan: { kelasId: { in: kelasIds } },
      },
      _count: { _all: true },
    });
    for (const b of barisAbsen) {
      const kelasId = petaPertemuan.get(b.pertemuanId);
      if (!kelasId) continue;
      const e = hitung.get(kelasId) ?? { hadir: 0, sakit: 0, izin: 0, alpha: 0 };
      e[b.status as keyof typeof e] += b._count._all;
      hitung.set(kelasId, e);
    }
  }

  const statistik = kelasDiambil.map((k) => {
    const total = k.kelas.pertemuan.length;
    const e = hitung.get(k.kelasId) ?? { hadir: 0, sakit: 0, izin: 0, alpha: 0 };
    return {
      kelas: k.kelas,
      stat: statistikKehadiran(total, e.hadir),
      hadir: e.hadir,
      sakit: e.sakit,
      izin: e.izin,
      alpha: e.alpha,
      total,
    };
  });

  const adaRisiko = statistik.some((s) => !s.stat.memenuhi);

  return (
    <>
      <PageHeader
        judul="Absensi"
        deskripsi={`Scan QR atau masukkan kode unik dari dosen. Syarat minimal kehadiran: 75%.`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Panel check-in — 4 kolom */}
        <div className="lg:col-span-4">
          <Card className="sticky top-20">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-accent-subtle text-accent">
                  <QrCode className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                </div>
                <CardTitle>Absen masuk</CardTitle>
              </div>
              <p className="text-xs text-fg-muted">
                Berlaku hanya saat dosen membuka sesi absensi.
              </p>
            </CardHeader>
            <CardContent>
              <FormCheckin />
            </CardContent>
          </Card>
        </div>

        {/* Kanan: statistik + riwayat — 8 kolom */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          {adaRisiko && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-warning-border bg-warning-bg px-4 py-3"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-warning-text"
                strokeWidth={1.5}
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-fg">
                  Ada kelas yang belum memenuhi syarat 75%
                </p>
                <p className="text-xs text-fg-muted">
                  {statistik
                    .filter((s) => !s.stat.memenuhi)
                    .map(
                      (s) =>
                        `${s.kelas.mataKuliah.nama}: butuh ${s.stat.butuhHadir}× hadir lagi`
                    )
                    .join(" · ")}
                </p>
              </div>
            </div>
          )}

          {/* Statistik per kelas */}
          <Card>
            <CardHeader>
              <CardTitle>Kehadiran per mata kuliah</CardTitle>
              <p className="text-xs text-fg-muted">
                Semester {semesterAktif?.nama} {semesterAktif?.tahun.nama}
              </p>
            </CardHeader>
            <CardContent>
              {statistik.length === 0 ? (
                <EmptyState
                  compact
                  icon={CalendarCheck}
                  judul="Belum ada kelas diambil"
                  deskripsi="Statistik kehadiran muncul setelah Anda mengambil mata kuliah pada periode KRS."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {statistik.map((s) => (
                    <div
                      key={s.kelas.id}
                      className="rounded border border-border p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">
                            {s.kelas.mataKuliah.nama}
                          </p>
                          <p className="text-xs text-fg-muted">
                            {s.kelas.mataKuliah.kode} · {s.kelas.dosen.nama}
                          </p>
                        </div>
                        <Badge variant={s.stat.memenuhi ? "success" : "warning"}>
                          {s.stat.persen}%
                        </Badge>
                      </div>
                      <Progress
                        value={s.stat.persen}
                        tone={s.stat.memenuhi ? "success" : "warning"}
                        label={`Kehadiran ${s.kelas.mataKuliah.nama}`}
                        className="mt-3"
                      />
                      <div className="mt-2.5 flex flex-wrap gap-1.5 font-mono-nums text-2xs text-fg-subtle">
                        <span className="text-success-text">H {s.hadir}</span>
                        <span>S {s.sakit}</span>
                        <span>I {s.izin}</span>
                        <span className="text-danger-text">A {s.alpha}</span>
                        <span>· dari {s.total} pertemuan</span>
                        <span>· minimal {s.stat.minimal75}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Riwayat */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Riwayat kehadiran</CardTitle>
                <p className="text-xs text-fg-muted">
                  Maksimal 50 catatan terakhir
                </p>
              </div>
              <form>
                <label className="sr-only" htmlFor="filter-kelas">
                  Filter mata kuliah
                </label>
                <select
                  id="filter-kelas"
                  name="kelas"
                  defaultValue={searchParams.kelas ?? ""}
                  className="h-8 rounded border border-border bg-surface px-2 text-xs text-fg"
                >
                  <option value="">Semua mata kuliah</option>
                  {kelasDiambil.map((k) => (
                    <option key={k.kelasId} value={k.kelasId}>
                      {k.kelas.mataKuliah.nama}
                    </option>
                  ))}
                </select>
              </form>
            </CardHeader>
            <CardContent>
              {riwayat.length === 0 ? (
                <EmptyState
                  compact
                  icon={CalendarCheck}
                  judul="Belum ada catatan kehadiran"
                  deskripsi={
                    kelasTerpilih
                      ? "Belum ada absensi tercatat untuk mata kuliah ini."
                      : "Absensi akan tercatat setelah Anda melakukan check-in."
                  }
                />
              ) : (
                <div className="overflow-hidden rounded border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Pert.</TableHead>
                        <TableHead>Mata kuliah</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Metode</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                        <TableHead className="w-36 text-right">Surat izin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riwayat.map((r) => (
                        <TableRow key={r.id}>
                          <Num className="text-fg-muted">{r.pertemuan.nomor}</Num>
                          <TableCell className="font-medium text-fg">
                            {r.pertemuan.kelas.mataKuliah.nama}
                          </TableCell>
                          <TableCell className="text-fg-muted">
                            {format(r.pertemuan.tanggal, "d MMM yyyy", {
                              locale: localeId,
                            })}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs uppercase text-fg-subtle">
                              {r.metode === "qr"
                                ? "QR"
                                : r.metode === "kode"
                                  ? "Kode"
                                  : "Manual"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={TONE_STATUS[r.status]}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {r.surat ? (
                              <Badge
                                variant={
                                  r.surat.status === "disetujui"
                                    ? "success"
                                    : r.surat.status === "ditolak"
                                      ? "danger"
                                      : "warning"
                                }
                              >
                                {r.surat.status === "disetujui"
                                  ? "disetujui"
                                  : r.surat.status === "ditolak"
                                    ? "ditolak"
                                    : "menunggu"}
                              </Badge>
                            ) : r.status === "hadir" ? (
                              <span className="text-xs text-fg-subtle">—</span>
                            ) : (
                              <TombolSurat
                                absensiId={r.id}
                                konteks={`${r.pertemuan.kelas.mataKuliah.nama} pertemuan ke-${r.pertemuan.nomor}`}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
