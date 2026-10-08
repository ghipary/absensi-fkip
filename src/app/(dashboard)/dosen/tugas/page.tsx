import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ClipboardList } from "lucide-react";
import { PanelTugas } from "./panel-tugas";

export const metadata: Metadata = { title: "Kelola Tugas" };

export default async function HalamanTugasDosen({
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

  const daftarTugas = kelasTerpilih
    ? await prisma.tugas.findMany({
        where: { kelasId: kelasTerpilih.id, deletedAt: null },
        orderBy: { deadlineAt: "desc" },
        include: {
          _count: {
            select: {
              submission: true,
            },
          },
        },
      })
    : [];

  // Jumlah yang sudah dinilai per tugas
  const dinilaiPerTugas = kelasTerpilih
    ? await prisma.submission.groupBy({
        by: ["tugasId"],
        where: {
          tugas: { kelasId: kelasTerpilih.id },
          nilai: { not: null },
        },
        _count: { _all: true },
      })
    : [];
  const petaDinilai = new Map(dinilaiPerTugas.map((d) => [d.tugasId, d._count._all]));

  const anggota = kelasTerpilih
    ? await prisma.kRS.findMany({
        where: { kelasId: kelasTerpilih.id, status: "diambil" },
        include: {
          mahasiswa: {
            select: {
              id: true,
              nim: true,
              nama: true,
              submission: {
                where: { tugas: { kelasId: kelasTerpilih.id } },
                select: {
                  id: true,
                  tugasId: true,
                  teks: true,
                  linkUrl: true,
                  submittedAt: true,
                  isTerlambat: true,
                  nilai: true,
                  feedback: true,
                },
              },
            },
          },
        },
        orderBy: { mahasiswa: { nim: "asc" } },
      })
    : [];

  return (
    <>
      <PageHeader
        judul="Kelola Tugas"
        deskripsi="Buat tugas, publikasikan ke mahasiswa, pantau pengumpulan, dan beri nilai plus feedback per mahasiswa."
      />

      {!kelasTerpilih ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            judul="Belum ada kelas yang diampu"
            deskripsi="Anda belum ditugaskan mengampu mata kuliah pada semester ini. Hubungi kaprodi untuk penugasan."
          />
        </Card>
      ) : (
        <PanelTugas
          daftarKelas={daftarKelas.map((k) => ({
            id: k.id,
            kode: k.mataKuliah.kode,
            nama: k.mataKuliah.nama,
            kodeKelas: k.kodeKelas,
            jumlahMhs: k._count.krs,
          }))}
          kelasIdAwal={kelasTerpilih.id}
          daftarTugas={daftarTugas.map((t) => ({
            id: t.id,
            judul: t.judul,
            deskripsi: t.deskripsi,
            deadlineAt: t.deadlineAt.toISOString(),
            bobotPoin: t.bobotPoin,
            published: t.publishedAt !== null,
            jumlahKumpul: t._count.submission,
            jumlahDinilai: petaDinilai.get(t.id) ?? 0,
          }))}
          anggota={anggota.map((a) => ({
            mahasiswaId: a.mahasiswa.id,
            nim: a.mahasiswa.nim,
            nama: a.mahasiswa.nama,
            submission: a.mahasiswa.submission.map((s) => ({
              tugasId: s.tugasId,
              id: s.id,
              teks: s.teks,
              linkUrl: s.linkUrl,
              submittedAt: s.submittedAt.toISOString(),
              isTerlambat: s.isTerlambat,
              nilai: s.nilai,
              feedback: s.feedback,
            })),
          }))}
          namaDosen={dosen.nama}
        />
      )}
    </>
  );
}
