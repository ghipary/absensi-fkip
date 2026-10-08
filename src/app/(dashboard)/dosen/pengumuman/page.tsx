import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keItemPengumuman } from "@/lib/pengumuman-dto";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PanelPengumuman } from "@/components/pengumuman/panel-pengumuman";

export const metadata: Metadata = { title: "Pengumuman" };

export default async function HalamanPengumumanDosen() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) redirect("/login");

  const dosen = await prisma.dosen.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  if (!dosen) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });

  const kelasOptions = semesterAktif
    ? await prisma.kelas.findMany({
        where: { dosenId: dosen.id, semesterId: semesterAktif.id, deletedAt: null },
        select: {
          id: true,
          kodeKelas: true,
          mataKuliah: { select: { kode: true, nama: true } },
        },
        orderBy: { mataKuliah: { kode: "asc" } },
      })
    : [];

  const rows = semesterAktif
    ? await prisma.pengumuman.findMany({
        where: {
          OR: [
            { semesterId: semesterAktif.id, cakupan: "prodi" },
            {
              semesterId: semesterAktif.id,
              kelas: { dosenId: dosen.id },
            },
            { createdById: user.userId, semesterId: semesterAktif.id },
          ],
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

  const daftar = rows.map((r) => keItemPengumuman(r, r.createdById === user.userId));

  return (
    <>
      <PageHeader
        judul="Pengumuman"
        deskripsi="Kelola pengumuman untuk mahasiswa prodi atau mahasiswa di kelas yang Anda ampu."
      />
      <Card>
        <CardContent className="pt-5">
          <PanelPengumuman
            daftar={daftar}
            kelola
            kelasOptions={kelasOptions.map((k) => ({
              value: k.id,
              label: `${k.mataKuliah.kode} · ${k.mataKuliah.nama} — Kelas ${k.kodeKelas}`,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}