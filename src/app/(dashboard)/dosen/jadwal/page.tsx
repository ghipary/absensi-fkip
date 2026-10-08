import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CalendarDays, BookOpen, Clock, MapPin, UsersRound } from "lucide-react";

export const metadata: Metadata = { title: "Jadwal Mengajar" };

const URUTAN_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

type UrutanHari = (typeof URUTAN_HARI)[number];

export default async function HalamanJadwalDosen() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) redirect("/login");

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahun: { select: { nama: true } } },
  });

  const kelasDiampu = semesterAktif
    ? await prisma.kelas.findMany({
        where: { dosenId: dosen.id, semesterId: semesterAktif.id, deletedAt: null },
        include: {
          mataKuliah: true,
          jadwal: true,
          _count: { select: { krs: { where: { status: "diambil" } } } },
        },
      })
    : [];

  const jadwal = kelasDiampu
    .flatMap((k) =>
      k.jadwal.map((j) => ({
        hari: j.hari as UrutanHari,
        jamMulai: j.jamMulai,
        jamSelesai: j.jamSelesai,
        ruang: j.ruang,
        kode: k.mataKuliah.kode,
        nama: k.mataKuliah.nama,
        sks: k.mataKuliah.sks,
        kodeKelas: k.kodeKelas,
        jumlahMhs: k._count.krs,
      }))
    )
    .sort(
      (a, b) =>
        URUTAN_HARI.indexOf(a.hari) - URUTAN_HARI.indexOf(b.hari) ||
        a.jamMulai.localeCompare(b.jamMulai)
    );

  const mkUnik = new Set(jadwal.map((j) => j.kode)).size;
  const hariKuliah = new Set(jadwal.map((j) => j.hari)).size;

  return (
    <>
      <PageHeader
        judul="Jadwal Mengajar"
        deskripsi={
          semesterAktif
            ? `Kelas yang Anda ampu pada ${semesterAktif.nama} ${semesterAktif.tahun.nama}.`
            : "Kelas yang Anda ampu pada semester berjalan."
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Sesi mengajar"
          value={jadwal.length}
          sub="per minggu"
          ikon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mata kuliah"
          value={mkUnik}
          sub={`${kelasDiampu.length} kelas`}
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Hari mengajar"
          value={hariKuliah}
          sub="dari 6 hari"
          ikon={<Clock className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Total mahasiswa"
          value={kelasDiampu.reduce((a, k) => a + k._count.krs, 0)}
          sub="terdaftar di kelas Anda"
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jadwal mingguan</CardTitle>
          <p className="text-xs text-fg-muted">
            Urut dari hari Senin · jumlah mahasiswa diambil dari KRS aktif.
          </p>
        </CardHeader>
        <CardContent>
          {jadwal.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              judul="Belum ada kelas diampu"
              deskripsi="Anda belum ditugaskan mengampu mata kuliah pada semester ini. Hubungi kaprodi."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Hari</TableHead>
                    <TableHead className="w-32">Jam</TableHead>
                    <TableHead>Mata kuliah</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Mahasiswa</TableHead>
                    <TableHead>Ruang</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jadwal.map((j, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <span className="font-medium text-fg">{j.hari}</span>
                      </TableCell>
                      <TableCell>
                        <Num className="text-fg-muted">
                          {j.jamMulai}–{j.jamSelesai}
                        </Num>
                      </TableCell>
                      <TableCell>
                        <span className="block font-medium text-fg">{j.nama}</span>
                        <span className="text-2xs text-fg-subtle">
                          {j.kode} · {j.sks} SKS
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        Kelas {j.kodeKelas}
                      </TableCell>
                      <TableCell>
                        <Num className="text-fg">{j.jumlahMhs}</Num>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-fg-muted">
                          <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          {j.ruang}
                        </span>
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