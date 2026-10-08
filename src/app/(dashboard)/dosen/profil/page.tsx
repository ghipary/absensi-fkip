import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Info,
  Layers,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { inisial } from "@/lib/utils";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "Profil Dosen" };

function tanggal(iso: Date, denganJam = false) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    ...(denganJam ? { timeStyle: "short" as const } : {}),
  }).format(iso);
}

/** Baris label–nilai pada kartu profil. */
function Baris({
  label,
  nilai,
}: {
  label: string;
  nilai: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-xs text-fg-muted">{label}</dt>
      <dd className="text-right text-sm text-fg">{nilai}</dd>
    </div>
  );
}

export default async function HalamanProfilDosen() {
  const user = await getCurrentUser();
  if (!user || user.role !== "dosen") redirect("/login");

  const dosen = await prisma.dosen.findUnique({
    where: { userId: user.userId },
    include: {
      user: {
        select: { email: true, status: true, lastLoginAt: true, createdAt: true },
      },
      kelasDiampu: {
        where: { deletedAt: null },
        include: {
          mataKuliah: { select: { kode: true, nama: true, sks: true } },
          semester: {
            select: {
              nama: true,
              isAktif: true,
              tahun: { select: { nama: true } },
            },
          },
          jadwal: {
            select: { hari: true, jamMulai: true, jamSelesai: true, ruang: true },
          },
          _count: { select: { krs: true } },
        },
        orderBy: [
          { semester: { tanggalMulai: "desc" } },
          { mataKuliah: { kode: "asc" } },
        ],
      },
    },
  });

  if (!dosen) redirect("/login");

  const jumlahKelas = dosen.kelasDiampu.length;
  const jumlahMahasiswa = dosen.kelasDiampu.reduce(
    (a, k) => a + k._count.krs,
    0
  );
  const jumlahJadwal = dosen.kelasDiampu.reduce(
    (a, k) => a + k.jadwal.length,
    0
  );
  const mkUnik = new Set(dosen.kelasDiampu.map((k) => k.mataKuliah.kode)).size;

  return (
    <>
      <PageHeader
        judul="Profil Dosen"
        deskripsi="Data pribadi, kelas yang diampu, dan ringkasan aktivitas mengajar Anda."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Kelas diampu"
          value={jumlahKelas}
          sub={`${mkUnik} mata kuliah`}
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Mahasiswa"
          value={jumlahMahasiswa}
          sub="terdaftar di kelas Anda"
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Jadwal mengajar"
          value={jumlahJadwal}
          sub="slot per minggu"
          ikon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Status akun"
          value={dosen.status === "aktif" ? "Aktif" : "Nonaktif"}
          sub={dosen.user.email}
          ikon={<ShieldCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-accent" strokeWidth={1.5} aria-hidden />
              Data pribadi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-sm">
                  {inisial(dosen.nama)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">
                  {dosen.nama}
                  {dosen.gelar ? `, ${dosen.gelar}` : ""}
                </p>
                <p className="font-mono-nums text-xs text-fg-muted">
                  NIP {dosen.nip}
                </p>
              </div>
              <Badge
                variant={dosen.status === "aktif" ? "success" : "neutral"}
                className="ml-auto"
              >
                {dosen.status}
              </Badge>
            </div>

            <dl className="mt-5 flex flex-col gap-3">
              <Baris
                label="Email"
                nilai={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                    {dosen.user.email}
                  </span>
                }
              />
              <Baris
                label="Telepon"
                nilai={
                  dosen.telepon ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                      {dosen.telepon}
                    </span>
                  ) : (
                    <span className="text-fg-subtle">Belum diisi</span>
                  )
                }
              />
              <Baris
                label="Bidang studi"
                nilai={dosen.bidangStudi ?? <span className="text-fg-subtle">Belum diisi</span>}
              />
              <Baris
                label="Terdaftar sejak"
                nilai={tanggal(dosen.user.createdAt)}
              />
              <Baris
                label="Login terakhir"
                nilai={
                  dosen.user.lastLoginAt ? (
                    tanggal(dosen.user.lastLoginAt, true)
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-fg-subtle" strokeWidth={1.5} aria-hidden />
              Ketentuan mengajar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5 text-sm text-fg-muted">
              <li className="flex gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                Setiap mata kuliah memiliki 16 pertemuan. Absensi dibuka dosen
                pengampu pada tiap pertemuan.
              </li>
              <li className="flex gap-2.5">
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                Nilai akhir dihitung dari tugas, UTS, dan UAS sesuai bobot kelas.
              </li>
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                Perubahan nilai dan absensi tercatat pada riwayat untuk audit.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-accent" strokeWidth={1.5} aria-hidden />
              Kelas yang diampu
            </CardTitle>
            <p className="text-xs text-fg-muted">
              {jumlahKelas > 0
                ? `${jumlahKelas} kelas pada semester berjalan dan riwayat.`
                : "Belum ada kelas yang diampu."}
            </p>
          </CardHeader>
          <CardContent>
            {dosen.kelasDiampu.length === 0 ? (
              <EmptyState
                compact
                judul="Belum ada kelas"
                deskripsi="Anda belum ditetapkan sebagai pengampu mata kuliah mana pun."
              />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {dosen.kelasDiampu.map((k) => (
                  <li
                    key={k.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-surface-muted/40 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">
                        {k.mataKuliah.kode} · {k.mataKuliah.nama}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {k.semester.nama} {k.semester.tahun.nama} · Kelas{" "}
                        {k.kodeKelas} · {k.mataKuliah.sks} SKS
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {k.semester.isAktif && <Badge variant="accent">Semester aktif</Badge>}
                      <Badge variant="neutral">
                        {k._count.krs} mahasiswa
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
