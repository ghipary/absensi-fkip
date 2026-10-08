import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { History } from "lucide-react";
import { PanelNilai } from "./panel-nilai";

export const metadata: Metadata = { title: "Input Nilai" };

export default async function HalamanNilaiDosen({
  searchParams,
}: {
  searchParams: { kelas?: string };
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    redirect("/login");
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({ where: { isAktif: true } });

  const daftarKelas = semesterAktif
    ? await prisma.kelas.findMany({
        where: { dosenId: dosen.id, semesterId: semesterAktif.id, deletedAt: null },
        include: {
          mataKuliah: true,
          _count: { select: { krs: { where: { status: "diambil" } } } },
        },
        orderBy: { mataKuliah: { kode: "asc" } },
      })
    : [];

  const kelasTerpilih =
    daftarKelas.find((k) => k.id === searchParams.kelas) ?? daftarKelas[0];

  const daftarAnggota = kelasTerpilih
    ? await prisma.kRS.findMany({
        where: { kelasId: kelasTerpilih.id, status: "diambil" },
        select: { mahasiswa: { select: { id: true, nim: true, nama: true } } },
        orderBy: { mahasiswa: { nim: "asc" } },
      })
    : [];

  const daftarNilai = kelasTerpilih
    ? await prisma.nilai.findMany({
        where: { kelasId: kelasTerpilih.id },
        select: { mahasiswaId: true, tugas: true, uts: true, uas: true, akhir: true, grade: true },
      })
    : [];
  const petaNilai = new Map(daftarNilai.map((n) => [n.mahasiswaId, n]));

  const anggota = daftarAnggota.map((a) => ({
    mahasiswaId: a.mahasiswa.id,
    nim: a.mahasiswa.nim,
    nama: a.mahasiswa.nama,
    nilai: petaNilai.get(a.mahasiswa.id) ?? null,
  }));

  // Riwayat perubahan terakhir untuk kelas ini (untuk undo)
  const riwayat = kelasTerpilih
    ? await prisma.riwayatPerubahan.findMany({
        where: { kelasId: kelasTerpilih.id, tipe: "nilai" },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: {
          pelaku: {
            select: { email: true, dosen: { select: { nama: true } }, mahasiswa: { select: { nama: true } } },
          },
          nilai: { select: { mahasiswa: { select: { nama: true, nim: true } } } },
        },
      })
    : [];

  const menungguCount = kelasTerpilih
    ? await prisma.riwayatPerubahan.count({
        where: { kelasId: kelasTerpilih.id, tipe: "nilai", status: "menunggu" },
      })
    : 0;

  return (
    <>
      <PageHeader
        judul="Input Nilai"
        deskripsi="Isi komponen tugas, UTS, dan UAS. Nilai akhir dan grade dihitung otomatis; setiap perubahan tercatat di riwayat dan bisa diurungkan."
      />

      {!kelasTerpilih ? (
        <Card>
          <EmptyState
            icon={History}
            judul="Belum ada kelas yang diampu"
            deskripsi="Anda belum ditugaskan mengampu mata kuliah pada semester ini. Hubungi kaprodi untuk penugasan."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <PanelNilai
              daftarKelas={daftarKelas.map((k) => ({
                id: k.id,
                kode: k.mataKuliah.kode,
                nama: k.mataKuliah.nama,
                kodeKelas: k.kodeKelas,
                bobot: {
                  bobotTugas: k.bobotTugas,
                  bobotUTS: k.bobotUTS,
                  bobotUAS: k.bobotUAS,
                },
              }))}
              kelasIdAwal={kelasTerpilih.id}
              anggota={anggota.map((a) => ({
                mahasiswaId: a.mahasiswaId,
                nim: a.nim,
                nama: a.nama,
                tugas: a.nilai?.tugas ?? null,
                uts: a.nilai?.uts ?? null,
                uas: a.nilai?.uas ?? null,
                akhir: a.nilai?.akhir ?? null,
                grade: a.nilai?.grade ?? null,
              }))}
            />
          </div>

          <div className="flex flex-col gap-4 lg:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Riwayat perubahan</CardTitle>
                <p className="text-xs text-fg-muted">
                  {menungguCount > 0
                    ? `${menungguCount} perubahan menunggu validasi kaprodi.`
                    : "10 perubahan terakhir pada kelas ini."}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {riwayat.length === 0 ? (
                  <EmptyState
                    compact
                    icon={History}
                    judul="Belum ada riwayat"
                    deskripsi="Semua perubahan nilai pada kelas ini akan tercatat di sini."
                  />
                ) : (
                  riwayat.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-3 rounded border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">
                          {r.nilai?.mahasiswa?.nama ?? "Mahasiswa"}
                        </p>
                        <p className="text-xs text-fg-muted">
                          {r.alasan ?? "Penyesuaian nilai"}
                        </p>
                        <p className="font-mono-nums text-2xs text-fg-subtle">
                          {r.pelaku.dosen?.nama ??
                            r.pelaku.mahasiswa?.nama ??
                            r.pelaku.email} ·{" "}
                          {r.createdAt.toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
      )}
    </>
  );
}
