import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheSemesterAktif } from "@/lib/cache";
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
import { BookOpen, ClipboardList, Mail, UsersRound } from "lucide-react";

export const metadata: Metadata = { title: "Monitoring Dosen" };

export default async function HalamanDosenKaprodi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const semesterAktif = await cacheSemesterAktif();

  const dosens = await prisma.dosen.findMany({
    where: { status: "aktif" },
    include: {
      user: { select: { email: true, status: true } },
      kelasDiampu: {
        where: semesterAktif
          ? { semesterId: semesterAktif.id, deletedAt: null }
          : { deletedAt: null },
        include: { krs: { where: { status: "diambil" }, select: { id: true } } },
      },
      tugasDibuat: { where: { deletedAt: null }, select: { id: true } },
    },
    orderBy: { nama: "asc" },
  });

  const totalKelas = dosens.reduce((a, d) => a + d.kelasDiampu.length, 0);
  const totalMhs = dosens.reduce(
    (a, d) => a + d.kelasDiampu.reduce((x, k) => x + k.krs.length, 0),
    0
  );
  const tanpaKelas = dosens.filter((d) => d.kelasDiampu.length === 0).length;

  return (
    <>
      <PageHeader
        judul="Monitoring Dosen"
        deskripsi={
          semesterAktif
            ? `Dosen aktif, beban mengajar, dan keterisian kelas pada ${semesterAktif.nama} ${semesterAktif.tahun.nama}.`
            : "Dosen aktif dan beban mengajar semester berjalan."
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Dosen aktif"
          value={dosens.length}
          sub="profil terdata"
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Kelas diampu"
          value={totalKelas}
          sub="kelas semester ini"
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mahasiswa terdampak"
          value={totalMhs}
          sub="kursi kelas terisi"
          ikon={<ClipboardList className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Dosen tanpa kelas"
          value={tanpaKelas}
          sub={tanpaKelas > 0 ? "perlu penugasan" : "semua punya kelas"}
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar dosen</CardTitle>
          <p className="text-xs text-fg-muted">
            Beban mengajar dihitung dari kelas aktif (belum dihapus) pada semester ini.
          </p>
        </CardHeader>
        <CardContent>
          {dosens.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              judul="Belum ada dosen"
              deskripsi="Belum ada profil dosen aktif yang terdaftar."
            />
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">NIP</TableHead>
                    <TableHead>Dosen</TableHead>
                    <TableHead>Bidang</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-20 text-right">Kelas</TableHead>
                    <TableHead className="w-24 text-right">Mahasiswa</TableHead>
                    <TableHead className="w-20 text-right">Tugas</TableHead>
                    <TableHead className="w-20 text-center">Akun</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dosens.map((d) => {
                    const jmlKelas = d.kelasDiampu.length;
                    const jmlMhs = d.kelasDiampu.reduce((a, k) => a + k.krs.length, 0);
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Num className="text-fg-muted">{d.nip}</Num>
                        </TableCell>
                        <TableCell>
                          <span className="block font-medium text-fg">{d.nama}</span>
                          {d.gelar && <span className="text-2xs text-fg-subtle">{d.gelar}</span>}
                        </TableCell>
                        <TableCell className="text-fg-muted">{d.bidangStudi ?? "—"}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                            <Mail className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                            {d.user.email}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Num className="text-fg">{jmlKelas}</Num>
                        </TableCell>
                        <TableCell className="text-right">
                          <Num className="text-fg">{jmlMhs}</Num>
                        </TableCell>
                        <TableCell className="text-right">
                          <Num className="text-fg-muted">{d.tugasDibuat.length}</Num>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={d.user.status === "aktif" ? "success" : "warning"}>
                            {d.user.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}