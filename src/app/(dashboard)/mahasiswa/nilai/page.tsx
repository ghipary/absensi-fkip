import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hitungIpk } from "@/lib/grade";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
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
import { GraduationCap, BookOpen, History, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Nilai Saya" };

const TONE_GRADE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "warning",
  E: "danger",
};

export default async function HalamanNilaiMahasiswa() {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") redirect("/login");

  const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: user.userId } });
  if (!mahasiswa) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahun: { select: { nama: true } } },
  });
  const krsAktif = semesterAktif
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
              dosen: { select: { nama: true } },
              nilai: { where: { mahasiswaId: mahasiswa.id } },
            },
          },
        },
        orderBy: { kelas: { mataKuliah: { kode: "asc" } } },
      })
    : [];

  // IPK sementara dari kelas yang sudah punya nilai akhir
  const ipk = hitungIpk(
    krsAktif
      .filter((k) => k.kelas.nilai[0]?.akhir !== null)
      .map((k) => ({
        akhir: k.kelas.nilai[0]!.akhir,
        sks: k.kelas.mataKuliah.sks,
      }))
  );

  const nilaiTerisi = krsAktif.filter((k) => k.kelas.nilai[0]?.akhir !== null);
  const jumlahLulus = nilaiTerisi.filter((k) =>
    ["A", "B", "C"].includes(k.kelas.nilai[0]!.grade ?? "")
  ).length;
  const sudahDiisi = nilaiTerisi.length;

  // Riwayat perubahan nilai milik sendiri
  const riwayat = await prisma.riwayatPerubahan.findMany({
    where: { tipe: "nilai", mahasiswaId: mahasiswa.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      pelaku: { select: { email: true, dosen: { select: { nama: true } } } },
      nilai: { select: { kelas: { select: { mataKuliah: { select: { kode: true, nama: true } } } } } },
    },
  });

  return (
    <>
      <PageHeader
        judul="Nilai Saya"
        deskripsi="Nilai akhir per mata kuliah semester berjalan, termasuk riwayat setiap perubahan yang dilakukan dosen."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="IPK sementara"
          value={ipk.toFixed(2)}
          ikon={<GraduationCap className="h-4 w-4" strokeWidth={1.5} />}
          sub="skala 4.00"
        />
        <StatCard
          label="Mata kuliah"
          value={krsAktif.length}
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} />}
          sub={`${krsAktif.reduce((a, k) => a + k.kelas.mataKuliah.sks, 0)} SKS`}
        />
        <StatCard
          label="Nilai sudah terbit"
          value={sudahDiisi}
          ikon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
          sub={sudahDiisi < krsAktif.length ? `${krsAktif.length - sudahDiisi} belum` : "semua terbit"}
        />
        <StatCard
          label="Predikat A/B/C"
          value={jumlahLulus}
          ikon={<History className="h-4 w-4" strokeWidth={1.5} />}
          sub="berpredikat"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card>
            <CardHeader>
              <CardTitle>Nilai per mata kuliah</CardTitle>
              <p className="text-xs text-fg-muted">
                {semesterAktif
                  ? `${semesterAktif.nama} ${semesterAktif.tahun.nama}`
                  : "Belum ada semester aktif"}
              </p>
            </CardHeader>
            <CardContent>
              {krsAktif.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  judul="Belum ada kelas diambil"
                  deskripsi="Anda belum mengambil mata kuliah apa pun. Buka halaman KRS untuk memilih kelas."
                  aksi={
                    <Link href="/mahasiswa/profil" className="text-sm text-accent hover:underline">
                      Lihat KRS saya →
                    </Link>
                  }
                />
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Kode</TableHead>
                        <TableHead>Mata kuliah</TableHead>
                        <TableHead className="w-14 text-right">SKS</TableHead>
                        <TableHead className="w-20 text-right">Tugas</TableHead>
                        <TableHead className="w-16 text-right">UTS</TableHead>
                        <TableHead className="w-16 text-right">UAS</TableHead>
                        <TableHead className="w-16 text-right">Akhir</TableHead>
                        <TableHead className="w-16 text-center">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {krsAktif.map((k) => {
                        const n = k.kelas.nilai[0];
                        return (
                          <TableRow key={k.kelasId}>
                            <TableCell>
                              <Num className="text-fg-muted">{k.kelas.mataKuliah.kode}</Num>
                            </TableCell>
                            <TableCell>
                              <span className="block truncate font-medium text-fg">
                                {k.kelas.mataKuliah.nama}
                              </span>
                              <span className="text-2xs text-fg-subtle">
                                {k.kelas.dosen?.nama ?? "—"} · Kelas {k.kelas.kodeKelas}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Num className="text-fg-muted">{k.kelas.mataKuliah.sks}</Num>
                            </TableCell>
                            {(["tugas", "uts", "uas", "akhir"] as const).map((kolom) => (
                              <TableCell key={kolom} className="text-right">
                                <Num className={kolom === "akhir" ? "font-semibold text-fg" : "text-fg-muted"}>
                                  {n && n[kolom] !== null ? n[kolom] : "—"}
                                </Num>
                              </TableCell>
                            ))}
                            <TableCell className="text-center">
                              {n?.grade ? (
                                <Badge variant={TONE_GRADE[n.grade] ?? "neutral"}>{n.grade}</Badge>
                              ) : (
                                <span className="text-fg-subtle">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="mt-3 text-2xs text-fg-subtle">
                Skala nilai: A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 · E &lt; 50. Bobot komponen
                mengikuti pengaturan masing-masing kelas.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat perubahan nilai</CardTitle>
              <p className="text-xs text-fg-muted">
                10 perubahan terbaru pada nilai Anda. Tidak ada nilai yang dihapus — hanya
                ditimpa dengan catatan.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {riwayat.length === 0 ? (
                <EmptyState
                  compact
                  icon={History}
                  judul="Belum ada riwayat"
                  deskripsi="Perubahan nilai oleh dosen pengampu akan tercatat di sini."
                />
              ) : (
                riwayat.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {r.nilai?.kelas.mataKuliah.kode} · {r.nilai?.kelas.mataKuliah.nama}
                      </p>
                      <p className="text-xs text-fg-muted">{r.alasan ?? "Penyesuaian nilai"}</p>
                      <p className="font-mono-nums text-2xs text-fg-subtle">
                        {r.pelaku.dosen?.nama ?? r.pelaku.email} ·{" "}
                        {format(r.createdAt, "d MMM yyyy · HH:mm", { locale: localeId })}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-pill border px-2 py-0.5 text-2xs font-medium " +
                        (r.status === "menunggu"
                          ? "border-warning-border bg-warning-bg text-warning-text"
                          : r.status === "ditolak"
                            ? "border-danger-border bg-danger-bg text-danger-text"
                            : r.status === "disetujui"
                              ? "border-success-border bg-success-bg text-success-text"
                              : "border-border bg-surface-muted text-fg-muted")
                      }
                    >
                      {r.status === "menunggu"
                        ? "menunggu"
                        : r.status === "disetujui"
                          ? "disetujui"
                          : r.status === "ditolak"
                            ? "ditolak"
                            : "otomatis"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
