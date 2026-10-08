import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { inisial } from "@/lib/utils";
import {
  BookOpen,
  CalendarRange,
  GraduationCap,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

export const metadata: Metadata = { title: "Profil Kaprodi" };

export default async function HalamanProfilKaprodi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const [akun, semesterAktif, hitung] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.semester.findFirst({
      where: { isAktif: true },
      include: { tahun: { select: { nama: true } } },
    }),
    Promise.all([
      prisma.dosen.count({ where: { status: { not: "nonaktif" } } }),
      prisma.mahasiswa.count({ where: { status: { in: ["aktif", "cuti"] } } }),
      prisma.mataKuliah.count({ where: { deletedAt: null } }),
      prisma.kelas.count({ where: { deletedAt: null } }),
    ]),
  ]);

  const [jumlahDosen, jumlahMhs, jumlahMK, jumlahKelas] = hitung;

  return (
    <>
      <PageHeader
        judul="Profil Kaprodi"
        deskripsi="Akun operator program studi beserta ringkasan status akademik."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Dosen aktif"
          value={jumlahDosen}
          sub="tidak termasuk nonaktif"
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mahasiswa aktif"
          value={jumlahMhs}
          sub="aktif + cuti"
          ikon={<GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mata kuliah"
          value={jumlahMK}
          sub="belum dihapus"
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Kelas"
          value={jumlahKelas}
          sub="tersedia"
          ikon={<CalendarRange className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-accent" strokeWidth={1.5} aria-hidden />
              Akun operator
            </CardTitle>
          </CardHeader>
          <CardContent>
            {akun ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 sm:col-span-2">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="text-sm">{inisial(user.nama)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-fg">{user.nama}</p>
                    <p className="text-sm text-fg-muted">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-2xs font-medium uppercase tracking-wide text-fg-subtle">
                    Peran
                  </dt>
                  <dd className="flex items-center gap-1.5 text-sm font-medium text-fg">
                    <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.5} aria-hidden />
                    Kepala Program Studi
                    <Badge variant="accent">operator</Badge>
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-2xs font-medium uppercase tracking-wide text-fg-subtle">
                    Status akun
                  </dt>
                  <dd>
                    <Badge variant={akun.status === "aktif" ? "success" : "neutral"}>
                      {akun.status}
                    </Badge>
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-2xs font-medium uppercase tracking-wide text-fg-subtle">
                    Login terakhir
                  </dt>
                  <dd className="text-sm text-fg">
                    {akun.lastLoginAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(akun.lastLoginAt)
                      : "—"}
                  </dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-2xs font-medium uppercase tracking-wide text-fg-subtle">
                    Akun dibuat
                  </dt>
                  <dd className="text-sm text-fg">
                    {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
                      akun.createdAt
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-fg-muted">Data akun tidak ditemukan.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}