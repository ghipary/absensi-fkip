import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keItemPengumuman } from "@/lib/pengumuman-dto";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PanelPengumuman } from "@/components/pengumuman/panel-pengumuman";

export const metadata: Metadata = { title: "Pengumuman" };

export default async function HalamanPengumumanMahasiswa() {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") redirect("/login");

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  if (!mahasiswa) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });

  const kelasDiambil = semesterAktif
    ? (
        await prisma.kRS.findMany({
          where: { mahasiswaId: mahasiswa.id, status: "diambil" },
          select: { kelasId: true },
        })
      ).map((k) => k.kelasId)
    : [];

  const rows = semesterAktif
    ? await prisma.pengumuman.findMany({
        where: {
          semesterId: semesterAktif.id,
          OR: [{ cakupan: "prodi" }, { cakupan: "kelas", kelasId: { in: kelasDiambil } }],
        },
        orderBy: { publishedAt: "desc" },
        include: {
          pembuat: { select: { dosen: { select: { nama: true } } } },
          kelas: {
            select: {
              kodeKelas: true,
              mataKuliah: { select: { kode: true, nama: true } },
            },
          },
        },
      })
    : [];

  const daftar = rows.map((r) => keItemPengumuman(r));

  return (
    <>
      <PageHeader
        judul="Pengumuman"
        deskripsi="Informasi resmi dari program studi dan dosen pengampu Anda."
      />
      <Card>
        <CardContent className="pt-5">
          <PanelPengumuman daftar={daftar} />
        </CardContent>
      </Card>
    </>
  );
}