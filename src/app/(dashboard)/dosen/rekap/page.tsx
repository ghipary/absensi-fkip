import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statistikKehadiran } from "@/lib/grade";
import { PageHeader } from "@/components/shared/page-header";
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
import { CalendarDays, GraduationCap, QrCode, UsersRound } from "lucide-react";

export const metadata: Metadata = { title: "Rekap Kelas" };

const TONE_GRADE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "warning",
  E: "danger",
};

type AbsenRingkas = { hadir: number; sakit: number; izin: number; alpha: number };

export default async function HalamanRekapDosen() {
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
          jadwal: { select: { hari: true, jamMulai: true, jamSelesai: true, ruang: true } },
          pertemuan: {
            orderBy: { nomor: "asc" },
            select: { id: true, nomor: true, tanggal: true },
          },
          krs: {
            where: { status: "diambil" },
            include: { mahasiswa: { select: { id: true, nim: true, nama: true } } },
            orderBy: { mahasiswa: { nim: "asc" } },
          },
        },
        orderBy: { mataKuliah: { kode: "asc" } },
      })
    : [];

  // Kumpulkan ringkasan per kelas
  const rekapKelas = await Promise.all(
    kelasDiampu.map(async (kelas) => {
      const mhsIds = kelas.krs.map((k) => k.mahasiswa.id);

      const [barisAbsensi, barisNilai] = await Promise.all([
        prisma.absensi.groupBy({
          by: ["mahasiswaId", "status"],
          where: {
            mahasiswaId: { in: mhsIds },
            pertemuan: { kelasId: kelas.id },
          },
          _count: { _all: true },
        }),
        prisma.nilai.findMany({
          where: { kelasId: kelas.id, mahasiswaId: { in: mhsIds } },
          select: {
            mahasiswaId: true,
            tugas: true,
            uts: true,
            uas: true,
            akhir: true,
            grade: true,
          },
        }),
      ]);

      const absenMap = new Map<string, AbsenRingkas>();
      for (const mhsId of mhsIds) absenMap.set(mhsId, { hadir: 0, sakit: 0, izin: 0, alpha: 0 });
      for (const a of barisAbsensi) {
        const e = absenMap.get(a.mahasiswaId) ?? { hadir: 0, sakit: 0, izin: 0, alpha: 0 };
        e[a.status as keyof AbsenRingkas] = a._count._all;
        absenMap.set(a.mahasiswaId, e);
      }

      const nilaiMap = new Map(barisNilai.map((n) => [n.mahasiswaId, n]));
      const totalPertemuan = kelas.pertemuan.length;

      const baris = kelas.krs.map((k) => {
        const absen = absenMap.get(k.mahasiswa.id)!;
        const stat = statistikKehadiran(totalPertemuan, absen.hadir);
        return {
          krsId: k.id,
          nim: k.mahasiswa.nim,
          nama: k.mahasiswa.nama,
          absen,
          stat,
          nilai: nilaiMap.get(k.mahasiswa.id) ?? null,
        };
      });

      const rataPersen = baris.length
        ? Math.round((baris.reduce((a, b) => a + b.stat.persen, 0) / baris.length) * 10) / 10
        : 0;
      const diBawah75 = baris.filter((b) => !b.stat.memenuhi).length;
      const nilaiTerisi = baris.filter((b) => b.nilai?.akhir !== null).length;

      return { kelas, baris, rataPersen, diBawah75, nilaiTerisi, totalPertemuan };
    })
  );

  return (
    <>
      <PageHeader
        judul="Rekap Kelas"
        deskripsi={
          semesterAktif
            ? `Ringkasan kehadiran dan nilai per mahasiswa untuk setiap kelas yang Anda ampu pada ${semesterAktif.nama} ${semesterAktif.tahun.nama}.`
            : "Ringkasan kehadiran dan nilai per kelas semester berjalan."
        }
      />

      {rekapKelas.length === 0 ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            judul="Belum ada kelas diampu"
            deskripsi="Anda belum ditugaskan mengampu mata kuliah pada semester ini."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {rekapKelas.map(({ kelas, baris, rataPersen, diBawah75, nilaiTerisi, totalPertemuan }) => (
            <Card key={kelas.id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>
                    {kelas.mataKuliah.kode} · {kelas.mataKuliah.nama}
                  </CardTitle>
                  <p className="text-xs text-fg-muted">
                    Kelas {kelas.kodeKelas} · {kelas.mataKuliah.sks} SKS
                    {kelas.jadwal[0] &&
                      ` · ${kelas.jadwal[0].hari} ${kelas.jadwal[0].jamMulai}–${kelas.jadwal[0].jamSelesai} (${kelas.jadwal[0].ruang})`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">
                    <UsersRound className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                    {baris.length} mahasiswa
                  </Badge>
                  <Badge variant={rataPersen >= 75 ? "success" : "warning"}>
                    <QrCode className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                    kehadiran {rataPersen}%
                  </Badge>
                  <Badge variant="neutral">
                    <GraduationCap className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                    {nilaiTerisi}/{baris.length} nilai terisi
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {baris.length === 0 ? (
                  <EmptyState
                    compact
                    judul="Tidak ada mahasiswa terdaftar"
                    deskripsi="Belum ada mahasiswa dengan status KRS diambil pada kelas ini."
                  />
                ) : (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">NIM</TableHead>
                          <TableHead>Mahasiswa</TableHead>
                          <TableHead className="w-36">Kehadiran</TableHead>
                          <TableHead className="w-16 text-center">H</TableHead>
                          <TableHead className="w-14 text-center">S</TableHead>
                          <TableHead className="w-14 text-center">I</TableHead>
                          <TableHead className="w-14 text-center">A</TableHead>
                          <TableHead className="w-16 text-right">Tugas</TableHead>
                          <TableHead className="w-16 text-right">UTS</TableHead>
                          <TableHead className="w-16 text-right">UAS</TableHead>
                          <TableHead className="w-16 text-right">Akhir</TableHead>
                          <TableHead className="w-20 text-center">Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {baris.map((b) => (
                          <TableRow key={b.krsId}>
                            <TableCell>
                              <Num className="text-fg-muted">{b.nim}</Num>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-fg">{b.nama}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={b.stat.persen}
                                  tone={b.stat.memenuhi ? "success" : "warning"}
                                  label={`Kehadiran ${b.nama}`}
                                  className="w-20"
                                />
                                <span className="font-mono-nums text-xs text-fg-muted">
                                  {b.stat.persen}%
                                </span>
                                {!b.stat.memenuhi && (
                                  <Badge variant="warning">di bawah 75%</Badge>
                                )}
                              </div>
                            </TableCell>
                            {(["hadir", "sakit", "izin", "alpha"] as const).map((k) => (
                              <TableCell key={k} className="text-center">
                                <Num className="text-fg-muted">{b.absen[k]}</Num>
                              </TableCell>
                            ))}
                            {(["tugas", "uts", "uas", "akhir"] as const).map((kolom) => (
                              <TableCell key={kolom} className="text-right">
                                <Num
                                  className={
                                    kolom === "akhir"
                                      ? "font-semibold text-fg"
                                      : "text-fg-muted"
                                  }
                                >
                                  {b.nilai?.[kolom] !== null && b.nilai?.[kolom] !== undefined
                                    ? b.nilai[kolom]
                                    : "—"}
                                </Num>
                              </TableCell>
                            ))}
                            <TableCell className="text-center">
                              {b.nilai?.grade ? (
                                <Badge variant={TONE_GRADE[b.nilai.grade] ?? "neutral"}>
                                  {b.nilai.grade}
                                </Badge>
                              ) : (
                                <span className="text-fg-subtle">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-2xs text-fg-subtle">
                  <span>Total pertemuan terjadwal: {totalPertemuan}</span>
                  <span>Rata-rata kehadiran kelas: {rataPersen}%</span>
                  <span className={diBawah75 > 0 ? "text-warning-text" : ""}>
                    {diBawah75} mahasiswa di bawah 75%
                  </span>
                  <span>H=hadir · S=sakit · I=izin · A=alpha</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}