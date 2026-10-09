import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ClipboardList, Clock, Send, CheckCircle2 } from "lucide-react";
import { TabelTugas } from "./tabel-tugas";

export const metadata: Metadata = { title: "Tugas Saya" };

export default async function HalamanTugasMahasiswa() {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") redirect("/login");

  const mahasiswa = await prisma.mahasiswa.findUnique({ where: { userId: user.userId } });
  if (!mahasiswa) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({ where: { isAktif: true } });

  const kelasDiambil = semesterAktif
    ? await prisma.kRS.findMany({
        where: { mahasiswaId: mahasiswa.id, status: "diambil", kelas: { semesterId: semesterAktif.id } },
        include: {
          kelas: {
            include: {
              mataKuliah: { select: { kode: true, nama: true } },
              dosen: { select: { nama: true } },
            },
          },
        },
      })
    : [];

  const kelasIds = kelasDiambil.map((k) => k.kelasId);

  const daftarTugas = kelasIds.length
    ? await prisma.tugas.findMany({
        where: { kelasId: { in: kelasIds }, deletedAt: null, publishedAt: { not: null } },
        orderBy: { deadlineAt: "asc" },
        include: {
          kelas: {
            select: {
              kodeKelas: true,
              mataKuliah: { select: { kode: true, nama: true } },
              dosen: { select: { nama: true } },
            },
          },
          submission: { where: { mahasiswaId: mahasiswa.id } },
        },
      })
    : [];

  const kini = Date.now();
  const belumKumpul = daftarTugas.filter(
    (t) => t.submission.length === 0 && new Date(t.deadlineAt).getTime() > kini
  ).length;
  const lewatTenggat = daftarTugas.filter(
    (t) => t.submission.length === 0 && new Date(t.deadlineAt).getTime() <= kini
  ).length;
  const sudahDinilai = daftarTugas.filter((t) => t.submission[0]?.nilai !== null && t.submission[0]?.nilai !== undefined).length;

  return (
    <>
      <PageHeader
        judul="Tugas Saya"
        deskripsi="Semua tugas dari kelas yang Anda ambil semester ini, lengkap dengan status pengumpulan dan nilai."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total tugas"
          value={daftarTugas.length}
          ikon={<ClipboardList className="h-4 w-4" strokeWidth={1.5} />}
        />
        <StatCard
          label="Belum dikumpulkan"
          value={belumKumpul}
          ikon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
          sub={belumKumpul > 0 ? "segera kerjakan" : undefined}
        />
        <StatCard
          label="Lewat tenggat"
          value={lewatTenggat}
          ikon={<Send className="h-4 w-4" strokeWidth={1.5} />}
          sub={lewatTenggat > 0 ? "terlambat" : undefined}
        />
        <StatCard
          label="Sudah dinilai"
          value={sudahDinilai}
          ikon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
        />
      </div>

      {daftarTugas.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            judul="Belum ada tugas"
            deskripsi={
              kelasIds.length === 0
                ? "Anda belum mengambil mata kuliah apa pun pada semester aktif. Hubungi kaprodi bila ini keliru."
                : "Belum ada tugas yang dipublikasikan dosen untuk kelas Anda. Tugas baru akan muncul di sini beserta notifikasi."
            }
          />
        </Card>
      ) : (
        <TabelTugas
          daftarTugas={daftarTugas.map((t) => ({
            id: t.id,
            judul: t.judul,
            deskripsi: t.deskripsi,
            deadlineAt: t.deadlineAt.toISOString(),
            bobotPoin: t.bobotPoin,
            kelas: `${t.kelas.mataKuliah.kode} · ${t.kelas.mataKuliah.nama} (${t.kelas.kodeKelas})`,
            dosen: t.kelas.dosen?.nama ?? "—",
            submission:
              t.submission.length > 0
                ? {
                    teks: t.submission[0].teks,
                    linkUrl: t.submission[0].linkUrl,
                    submittedAt: t.submission[0].submittedAt.toISOString(),
                    isTerlambat: t.submission[0].isTerlambat,
                    nilai: t.submission[0].nilai,
                    feedback: t.submission[0].feedback,
                  }
                : null,
          }))}
        />
      )}
    </>
  );
}
