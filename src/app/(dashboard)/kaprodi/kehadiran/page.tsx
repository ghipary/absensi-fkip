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
import { Activity, AlertTriangle, BookOpen, UsersRound } from "lucide-react";

export const metadata: Metadata = { title: "Monitoring Kehadiran" };

export default async function HalamanKehadiranKaprodi() {
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
          pertemuan: { select: { id: true } },
          krs: {
            where: { status: "diambil" },
            include: { mahasiswa: { select: { id: true, nim: true, nama: true } } },
          },
        },
        orderBy: { mataKuliah: { kode: "asc" } },
      })
    : [];

  const rincian = await muatRincianKehadiran(semesterAktif!.id);

  // Ringkasan per kelas — hitungan dikunci per (kelas, mahasiswa) sehingga
  // catatan absensi dari kelas lain tidak ikut tercampur (pernah bikin >100%).
  const perKelas = kelasList.map((kelas) => {
    const totalPertemuan = kelas.pertemuan.length;
    const baris = kelas.krs.map((r) =>
      statistikKehadiran(
        totalPertemuan,
        hitunganKelas(rincian, kelas.id, r.mahasiswa.id).hadir
      )
    );
    const persenKelas = baris.length
      ? Math.round((baris.reduce((a, s) => a + s.persen, 0) / baris.length) * 10) / 10
      : 0;
    const diBawah = baris.filter((s) => !s.memenuhi).length;
    return { kelas, persenKelas, diBawah };
  });

  const rataProdi = perKelas.length
    ? Math.round((perKelas.reduce((a, k) => a + k.persenKelas, 0) / perKelas.length) * 10) / 10
    : 0;

  // Mahasiswa berisiko: kehadiran semester < 75%, urut terkecil.
  // Akumulasi lintas kelas: hadir/total tiap kelas dijumlah per mahasiswa.
  const hitungGlobal = new Map<string, { hadir: number; total: number }>();
  const namaMhs = new Map<string, string>();
  for (const k of kelasList) {
    const totalP = k.pertemuan.length;
    for (const r of k.krs) {
      if (!namaMhs.has(r.mahasiswa.id)) namaMhs.set(r.mahasiswa.id, r.mahasiswa.nama);
      const e = hitunganKelas(rincian, k.id, r.mahasiswa.id);
      const cur = hitungGlobal.get(r.mahasiswa.id) ?? { hadir: 0, total: 0 };
      cur.total += totalP;
      cur.hadir += Math.min(e.hadir, totalP);
      hitungGlobal.set(r.mahasiswa.id, cur);
    }
  }

  const risiko = [...hitungGlobal.entries()]
    .map(([id, h]) => ({
      id,
      nama: namaMhs.get(id) ?? "—",
      total: h.total,
      stat: statistikKehadiran(h.total, h.hadir),
    }))
    .filter((r) => !r.stat.memenuhi && r.total >= 1)
    .sort((a, b) => a.stat.persen - b.stat.persen)
    .slice(0, 10);

  const totalMhs = hitungGlobal.size;
  const totalKelas = kelasList.length;

  return (
    <>
      <PageHeader
        judul="Monitoring Kehadiran"
        deskripsi={
          semesterAktif
            ? `Rekap kehadiran semua kelas ${semesterAktif.nama} ${semesterAktif.tahun.nama} dibanding syarat minimal 75%.`
            : "Rekap kehadiran semua kelas semester berjalan."
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Kelas aktif"
          value={totalKelas}
          sub="kelas semester ini"
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mahasiswa terdaftar"
          value={totalMhs}
          sub="di semua kelas"
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Kehadiran rata-rata"
          value={`${rataProdi}%`}
          sub={rataProdi >= 75 ? "memenuhi syarat" : "di bawah 75%"}
          ikon={<Activity className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mahasiswa berisiko"
          value={risiko.length}
          sub="kehadiran < 75%"
          ikon={<AlertTriangle className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kehadiran per kelas</CardTitle>
          <p className="text-xs text-fg-muted">Rata-rata kehadiran mahasiswa aktif di tiap kelas.</p>
        </CardHeader>
        <CardContent>
          {perKelas.length === 0 ? (
            <EmptyState
              icon={Activity}
              judul="Belum ada kelas"
              deskripsi="Belum ada kelas aktif pada semester ini."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Kode</TableHead>
                    <TableHead>Mata kuliah</TableHead>
                    <TableHead>Dosen</TableHead>
                    <TableHead className="w-24 text-right">Mahasiswa</TableHead>
                    <TableHead className="w-28 text-right">Pertemuan</TableHead>
                    <TableHead className="w-36">Rata-rata</TableHead>
                    <TableHead className="w-28 text-center">Di bawah 75%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perKelas.map(({ kelas, persenKelas, diBawah }) => (
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
                        <Num className="text-fg-muted">{kelas.pertemuan.length}</Num>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={persenKelas}
                            tone={persenKelas >= 75 ? "success" : "warning"}
                            label={`Rata-rata kehadiran ${kelas.mataKuliah.nama}`}
                            className="w-24"
                          />
                          <span className="font-mono-nums text-xs text-fg-muted">{persenKelas}%</span>
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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-text" strokeWidth={1.5} aria-hidden />
            Mahasiswa berisiko
          </CardTitle>
          <p className="text-xs text-fg-muted">
            Kehadiran semester ini di bawah 75% — kandidat mendapat surat peringatan.
          </p>
        </CardHeader>
        <CardContent>
          {risiko.length === 0 ? (
            <EmptyState
              compact
              icon={AlertTriangle}
              judul="Tidak ada mahasiswa berisiko"
              deskripsi="Semua mahasiswa aktif memenuhi syarat kehadiran minimal 75%."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mahasiswa</TableHead>
                    <TableHead className="w-32 text-right">Kehadiran</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risiko.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <span className="font-medium text-fg">{r.nama}</span>
                        <span className="text-2xs text-fg-subtle">peringkat {i + 1}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Num className="font-semibold text-warning-text">{r.stat.persen}%</Num>
                      </TableCell>
                      <TableCell>
                        <Badge variant="warning">
                          butuh {r.stat.butuhHadir}× hadir lagi
                        </Badge>
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