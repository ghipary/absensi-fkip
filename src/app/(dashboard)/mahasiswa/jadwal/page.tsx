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
import {
  CalendarDays,
  BookOpen,
  Clock,
  MapPin,
  School,
} from "lucide-react";

export const metadata: Metadata = { title: "Jadwal Kuliah" };

const URUTAN_HARI = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
] as const;

type UrutanHari = (typeof URUTAN_HARI)[number];

export default async function HalamanJadwalMahasiswa() {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") redirect("/login");

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
  });
  if (!mahasiswa) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahun: { select: { nama: true } } },
  });

  const krs = semesterAktif
    ? await prisma.kRS.findMany({
        where: {
          mahasiswaId: mahasiswa.id,
          status: { in: ["diambil", "lulus"] },
          kelas: { semesterId: semesterAktif.id, deletedAt: null },
        },
        include: {
          kelas: {
            include: {
              mataKuliah: true,
              dosen: { select: { nama: true, gelar: true } },
              jadwal: true,
            },
          },
        },
      })
    : [];

  const jadwal = krs
    .flatMap((k) =>
      k.kelas.jadwal.map((j) => ({
        hari: j.hari as UrutanHari,
        jamMulai: j.jamMulai,
        jamSelesai: j.jamSelesai,
        ruang: j.ruang,
        kode: k.kelas.mataKuliah.kode,
        nama: k.kelas.mataKuliah.nama,
        sks: k.kelas.mataKuliah.sks,
        kodeKelas: k.kelas.kodeKelas,
        dosen: `${k.kelas.dosen.gelar ?? ""} ${k.kelas.dosen.nama}`.trim(),
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
        judul="Jadwal Kuliah"
        deskripsi={
          semesterAktif
            ? `Jadwal perkuliahan ${semesterAktif.nama} ${semesterAktif.tahun.nama} yang Anda ikuti.`
            : "Jadwal perkuliahan semester berjalan."
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Jadwal per minggu"
          value={jadwal.length}
          sub="sesi perkuliahan"
          ikon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mata kuliah"
          value={mkUnik}
          sub={`${krs.reduce((a, k) => a + k.kelas.mataKuliah.sks, 0)} SKS`}
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Hari kuliah"
          value={hariKuliah}
          sub="dari 6 hari"
          ikon={<Clock className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Kampus"
          value="FKIP"
          sub="Universitas Wahidiyah"
          ikon={<School className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Jadwal mingguan</CardTitle>
          <p className="text-xs text-fg-muted">
            Urut dari hari Senin. Klik notifikasi pengingat bila jadwal berubah.
          </p>
        </CardHeader>
        <CardContent>
          {jadwal.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              judul="Belum ada jadwal"
              deskripsi="Anda belum memiliki mata kuliah berjadwal pada semester ini."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Hari</TableHead>
                    <TableHead className="w-32">Jam</TableHead>
                    <TableHead>Mata kuliah</TableHead>
                    <TableHead>Dosen</TableHead>
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
                          {j.kode} · {j.sks} SKS · Kelas {j.kodeKelas}
                        </span>
                      </TableCell>
                      <TableCell className="text-fg-muted">{j.dosen}</TableCell>
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