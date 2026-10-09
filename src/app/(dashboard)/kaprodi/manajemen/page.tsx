import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PanelManajemen } from "@/components/manajemen/panel-manajemen";
import { BookOpen, CalendarRange, UsersRound, GraduationCap } from "lucide-react";

export const metadata: Metadata = { title: "Manajemen Akademik" };

export default async function HalamanManajemenKaprodi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const [semesterList, mkList, dosenList, mahasiswaList, krsPengajuan, kelasAktif, kelasList] = await Promise.all([
    prisma.semester.findMany({
      include: { tahun: { select: { nama: true } } },
      orderBy: { tanggalMulai: "desc" },
    }),
    prisma.mataKuliah.findMany({
      include: { kelas: { where: { deletedAt: null }, select: { id: true } } },
      orderBy: { kode: "asc" },
    }),
    prisma.dosen.findMany({
      select: {
        id: true,
        userId: true,
        nama: true,
        nip: true,
        gelar: true,
        bidangStudi: true,
        semesterKe: true,
        status: true,
        user: { select: { email: true, role: true } },
      },
      orderBy: { nama: "asc" },
    }),
    prisma.mahasiswa.findMany({
      select: {
        id: true,
        userId: true,
        nama: true,
        nim: true,
        angkatan: true,
        jenisKelamin: true,
        kelasMhs: true,
        semesterKe: true,
        status: true,
        user: { select: { email: true } },
      },
      orderBy: { nim: "asc" },
    }),
    prisma.kRS.findMany({
      where: {
        status: "pengajuan",
        kelas: { semester: { isAktif: true }, deletedAt: null },
      },
      include: {
        mahasiswa: { select: { nama: true, nim: true } },
        kelas: {
          select: {
            kodeKelas: true,
            mataKuliah: { select: { kode: true, nama: true, sks: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    prisma.kelas.count({ where: { deletedAt: null } }),
    prisma.kelas.findMany({
      where: { deletedAt: null },
      include: {
        mataKuliah: { select: { id: true, kode: true, nama: true, sks: true } },
        semester: { include: { tahun: { select: { nama: true } } } },
        dosen: { select: { id: true, nama: true, gelar: true } },
        jadwal: { orderBy: { hari: "asc" }, take: 1 },
        krs: { where: { status: "diambil" }, select: { id: true } },
        pertemuan: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mkItems = mkList.map((m) => ({
    id: m.id,
    kode: m.kode,
    nama: m.nama,
    sks: m.sks,
    kategori: m.kategori,
    semesterKe: m.semesterKe,
    aktif: m.deletedAt === null,
    jumlahKelas: m.kelas.length,
  }));

  const dosenItems = dosenList.map((d) => ({
    id: d.id,
    userId: d.userId,
    nama: d.nama,
    nip: d.nip,
    gelar: d.gelar,
    bidang: d.bidangStudi,
    semesterKe: d.semesterKe,
    email: d.user.email,
    role: d.user.role === "kaprodi" ? ("kaprodi" as const) : ("dosen" as const),
    status: d.status,
  }));

  const mahasiswaItems = mahasiswaList.map((m) => ({
    id: m.id,
    userId: m.userId,
    nama: m.nama,
    nim: m.nim,
    angkatan: m.angkatan,
    jenisKelamin: m.jenisKelamin,
    kelasMhs: m.kelasMhs,
    semesterKe: m.semesterKe,
    email: m.user.email,
    status: m.status,
  }));

  const krsItems = krsPengajuan.map((k) => ({
    id: k.id,
    mahasiswa: k.mahasiswa.nama,
    nim: k.mahasiswa.nim,
    kode: k.kelas.mataKuliah.kode,
    nama: k.kelas.mataKuliah.nama,
    kodeKelas: k.kelas.kodeKelas,
    sks: k.kelas.mataKuliah.sks,
    diajukanPada: k.createdAt.toISOString(),
  }));

  const semesterItems = semesterList.map((s) => ({
    id: s.id,
    nama: s.nama,
    tahun: s.tahun.nama,
    tanggalMulai: s.tanggalMulai.toISOString(),
    tanggalSelesai: s.tanggalSelesai.toISOString(),
    isAktif: s.isAktif,
  }));

  const semesterAktif = semesterItems.find((s) => s.isAktif);

  const kelasItems = kelasList.map((k) => ({
    id: k.id,
    mkId: k.mataKuliah.id,
    mkKode: k.mataKuliah.kode,
    mkNama: k.mataKuliah.nama,
    sks: k.mataKuliah.sks,
    semesterId: k.semesterId,
    semesterLabel: `${k.semester.nama} ${k.semester.tahun.nama}`,
    semesterAktif: k.semester.isAktif,
    dosenId: k.dosen.id,
    dosenNama: k.dosen.gelar ? `${k.dosen.nama}, ${k.dosen.gelar}` : k.dosen.nama,
    kodeKelas: k.kodeKelas,
    kapasitas: k.kapasitas,
    jumlahMhs: k.krs.length,
    jumlahPertemuan: k.pertemuan.length,
    jadwal:
      k.jadwal[0] !== undefined
        ? {
            hari: k.jadwal[0].hari,
            jamMulai: k.jadwal[0].jamMulai,
            jamSelesai: k.jadwal[0].jamSelesai,
            ruang: k.jadwal[0].ruang,
          }
        : null,
  }));

  return (
    <>
      <PageHeader
        judul="Manajemen Akademik"
        deskripsi="Kelola mata kuliah, akun dosen & mahasiswa, dan semester aktif."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mata kuliah aktif"
          value={mkItems.filter((m) => m.aktif).length}
          sub={`${mkItems.length} total`}
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Dosen aktif"
          value={dosenList.filter((d) => d.status === "aktif").length}
          sub={`${dosenList.length} total`}
          ikon={<UsersRound className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Semester aktif"
          value={semesterAktif ? `${semesterAktif.nama} ${semesterAktif.tahun}` : "—"}
          sub={semesterAktif ? "berjalan" : "belum ditetapkan"}
          ikon={<CalendarRange className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Kelas tersedia"
          value={kelasAktif}
          sub="belum dihapus"
          ikon={<GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <Card>
        <CardContent className="pt-5">
          <PanelManajemen
            mkList={mkItems}
            dosenList={dosenItems}
            semesterList={semesterItems}
            mahasiswaList={mahasiswaItems}
            kelasList={kelasItems}
            krsPengajuan={krsItems}
            userIdSaya={user.userId}
          />
        </CardContent>
      </Card>
    </>
  );
}