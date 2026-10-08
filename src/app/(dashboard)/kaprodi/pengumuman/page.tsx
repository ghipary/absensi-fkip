import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keItemPengumuman } from "@/lib/pengumuman-dto";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PanelPengumuman } from "@/components/pengumuman/panel-pengumuman";

export const metadata: Metadata = { title: "Pengumuman" };

export default async function HalamanPengumumanKaprodi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });

  const kelasOptions = semesterAktif
    ? await prisma.kelas.findMany({
        where: { semesterId: semesterAktif.id, deletedAt: null },
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
          OR: [{ semesterId: semesterAktif.id }, { semesterId: null }],
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

  const daftar = rows.map((r) => keItemPengumuman(r, true));

  return (
    <>
      <PageHeader
        judul="Pengumuman"
        deskripsi="Kelola pengumuman untuk seluruh mahasiswa prodi atau per kelas."
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