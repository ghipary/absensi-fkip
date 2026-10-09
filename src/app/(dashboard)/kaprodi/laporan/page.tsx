import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { muatLaporanSemester, labelSemester } from "@/lib/laporan";
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
import { TombolEksporLaporan } from "@/components/charts/ekspor-laporan";
import {
  GrafikKehadiran,
  GrafikDistribusiNilai,
  GrafikTrenKehadiran,
} from "@/components/charts/grafik";
import { Activity, AlertTriangle, Award, BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Laporan Akademik" };

export default async function HalamanLaporanKaprodi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const laporan = await muatLaporanSemester();
  const {
    semester,
    kelas,
    rataProdi,
    distribusiNilai,
    rataNilai,
    trenBulanan,
    jumlahBerisiko,
  } = laporan;

  const dataKehadiran = kelas.map((k) => ({
    nama: k.mataKuliah,
    persen: k.rataKehadiran,
    memenuhi: k.rataKehadiran >= 75,
  }));

  return (
    <>
      <PageHeader
        judul="Laporan Akademik"
        deskripsi={
          semester
            ? `Ringkasan kehadiran, nilai, dan tren akademik ${labelSemester(semester)}.`
            : "Ringkasan akademik semester berjalan."
        }
        aksi={<TombolEksporLaporan />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Kelas aktif"
          value={kelas.length}
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
            {trenBulanan.length === 0 ? (
              <EmptyState compact judul="Belum ada data" deskripsi="Belum ada catatan absensi." />
            ) : (
              <GrafikTrenKehadiran data={trenBulanan} />
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
          <GrafikDistribusiNilai data={distribusiNilai} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Rekap per kelas</CardTitle>
          <p className="text-xs text-fg-muted">
            Dasar laporan; detail tiap mahasiswa tersedia pada berkas Excel/PDF.
          </p>
        </CardHeader>
        <CardContent>
          {kelas.length === 0 ? (
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
                  {kelas.map((k) => (
                    <TableRow key={k.kelasId}>
                      <TableCell>
                        <Num className="text-fg-muted">{k.kode}</Num>
                      </TableCell>
                      <TableCell>
                        <span className="block font-medium text-fg">{k.mataKuliah}</span>
                        <span className="text-2xs text-fg-subtle">Kelas {k.kelas}</span>
                      </TableCell>
                      <TableCell className="text-fg-muted">{k.dosen}</TableCell>
                      <TableCell className="text-right">
                        <Num className="text-fg">{k.jumlahMahasiswa}</Num>
                      </TableCell>
                      <TableCell className="text-right">
                        <Num className="text-fg-muted">{k.totalPertemuan}</Num>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={k.rataKehadiran}
                            tone={k.rataKehadiran >= 75 ? "success" : "warning"}
                            label={`Rata-rata kehadiran ${k.mataKuliah}`}
                            className="w-24"
                          />
                          <span className="font-mono-nums text-xs text-fg-muted">{k.rataKehadiran}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={k.diBawah75 > 0 ? "warning" : "success"}>{k.diBawah75} mhs</Badge>
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
