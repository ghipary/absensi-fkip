import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PanelKalender, type ItemAgenda } from "@/components/kalender/panel-kalender";
import { BookOpenCheck, CalendarDays, GraduationCap, Plane } from "lucide-react";

export const metadata: Metadata = { title: "Kalender Akademik" };

export default async function HalamanKalenderAkademik() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    include: { tahun: { select: { nama: true } } },
  });

  const agenda = semesterAktif
    ? await prisma.kalenderAkademik.findMany({
        where: { semesterId: semesterAktif.id },
        orderBy: { tanggal: "asc" },
      })
    : [];

  const items: ItemAgenda[] = agenda.map((a) => ({
    id: a.id,
    tanggal: a.tanggal.toISOString(),
    tipe: a.tipe,
    judul: a.judul,
    deskripsi: a.deskripsi,
  }));

  const hariIni = items.filter((a) => new Date(a.tanggal) >= new Date()).length;
  const jumlahUjian = items.filter((a) => a.tipe === "ujian").length;
  const jumlahLibur = items.filter((a) => a.tipe === "libur").length;

  return (
    <>
      <PageHeader
        judul="Kalender Akademik"
        deskripsi={
          semesterAktif
            ? `Agenda akademik semester ${semesterAktif.nama} ${semesterAktif.tahun.nama}.`
            : "Belum ada semester aktif yang ditetapkan kaprodi."
        }
      />

      {!semesterAktif ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            judul="Belum ada semester aktif"
            deskripsi="Kalender akademik akan tampil setelah kaprodi menetapkan semester aktif."
          />
        </Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total agenda"
              value={items.length}
              sub="semester ini"
              ikon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
            />
            <StatCard
              label="Agenda mendatang"
              value={hariIni}
              sub="hari ini dan setelahnya"
              ikon={<BookOpenCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
            />
            <StatCard
              label="Jadwal ujian"
              value={jumlahUjian}
              sub="UTS, UAS, dan sejenisnya"
              ikon={<GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
            />
            <StatCard
              label="Hari libur"
              value={jumlahLibur}
              sub="tanggal merah akademik"
              ikon={<Plane className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
            />
          </div>

          <PanelKalender agenda={items} bisaKelola={user.role === "kaprodi"} />
        </>
      )}
    </>
  );
}
