import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Info,
  Layers,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PanelKrs, type SemesterKrs } from "./panel-krs";
import { FormPengajuanKrs, type KelasTersedia } from "./form-pengajuan-krs";

export const metadata: Metadata = { title: "KRS & Profil" };

const LABEL_JK: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

function kapital(teks: string) {
  return teks.charAt(0).toUpperCase() + teks.slice(1);
}

/** Baris label–nilai pada kartu profil. */
function Baris({
  label,
  nilai,
  mono,
}: {
  label: string;
  nilai: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-xs text-fg-muted">{label}</dt>
      <dd
        className={cn(
          "text-right text-sm text-fg",
          mono && "font-mono-nums tnum"
        )}
      >
        {nilai}
      </dd>
    </div>
  );
}

export default async function HalamanKrsProfilMahasiswa() {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") redirect("/login");

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
    include: {
      user: {
        select: {
          email: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!mahasiswa) redirect("/login");

  // Seluruh KRS mahasiswa (semester aktif + riwayat), kelas terhapus disaring.
  const semuaKrs = await prisma.kRS.findMany({
    where: { mahasiswaId: mahasiswa.id, kelas: { deletedAt: null } },
    include: {
      kelas: {
        include: {
          mataKuliah: true,
          dosen: { select: { nama: true } },
          jadwal: true,
          semester: { include: { tahun: { select: { nama: true } } } },
        },
      },
    },
    orderBy: { kelas: { mataKuliah: { kode: "asc" } } },
  });

  // Kelas yang bisa diajukan: semester aktif, belum diambil / belum diajukan.
  const semesterAktifRow = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });
  let kelasTersedia: KelasTersedia[] = [];
  if (semesterAktifRow) {
    const sudah = new Set(
      semuaKrs
        .filter(
          (k) =>
            k.kelas.semester.id === semesterAktifRow.id &&
            (k.status === "diambil" || k.status === "pengajuan")
        )
        .map((k) => k.kelas.id)
    );
    const kelasAktif = await prisma.kelas.findMany({
      where: { semesterId: semesterAktifRow.id, deletedAt: null },
      include: { mataKuliah: true, dosen: { select: { nama: true } }, jadwal: true },
      orderBy: { mataKuliah: { kode: "asc" } },
    });
    kelasTersedia = kelasAktif
      .filter((k) => !sudah.has(k.id))
      .map((k) => ({
        id: k.id,
        kode: k.mataKuliah.kode,
        nama: k.mataKuliah.nama,
        sks: k.mataKuliah.sks,
        kodeKelas: k.kodeKelas,
        dosen: k.dosen.nama,
        jadwal: k.jadwal.map((j) => `${j.hari} ${j.jamMulai}–${j.jamSelesai} · ${j.ruang}`),
      }));
  }

  // Kelompokkan per semester — urut dari yang terbaru.
  const semesterMulai = new Map<string, number>();
  const petaSemester = new Map<string, SemesterKrs>();

  for (const k of semuaKrs) {
    const sem = k.kelas.semester;
    semesterMulai.set(sem.id, sem.tanggalMulai.getTime());

    const entri: SemesterKrs =
      petaSemester.get(sem.id) ?? {
        id: sem.id,
        label: `${sem.nama} ${sem.tahun.nama}`,
        aktif: sem.isAktif,
        totalSks: 0,
        baris: [],
      };

    entri.baris.push({
      id: k.id,
      kode: k.kelas.mataKuliah.kode,
      nama: k.kelas.mataKuliah.nama,
      sks: k.kelas.mataKuliah.sks,
      kodeKelas: k.kelas.kodeKelas,
      dosen: k.kelas.dosen.nama,
      status: k.status,
      jadwal: k.kelas.jadwal.map((j) => ({
        hari: j.hari,
        jam: `${j.jamMulai}–${j.jamSelesai}`,
        ruang: j.ruang,
      })),
    });
    entri.totalSks = entri.baris
      .filter((b) => b.status !== "drop" && b.status !== "pengajuan")
      .reduce((a, b) => a + b.sks, 0);

    petaSemester.set(sem.id, entri);
  }

  const daftarSemester = [...petaSemester.values()].sort(
    (a, b) => (semesterMulai.get(b.id) ?? 0) - (semesterMulai.get(a.id) ?? 0)
  );

  const krsAktif = semuaKrs.filter(
    (k) => k.kelas.semester.isAktif && k.status === "diambil"
  );
  const sksAktif = krsAktif.reduce((a, k) => a + k.kelas.mataKuliah.sks, 0);
  const jumlahPengajuan = semuaKrs.filter(
    (k) => k.kelas.semester.isAktif && k.status === "pengajuan"
  ).length;

  const krsDitempuh = semuaKrs.filter((k) => k.status !== "drop");
  const sksTotal = krsDitempuh.reduce((a, k) => a + k.kelas.mataKuliah.sks, 0);
  const mkLulus = semuaKrs.filter((k) => k.status === "lulus").length;

  const inisial = mahasiswa.nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <PageHeader
        judul="KRS & Profil"
        deskripsi="Kartu Rencana Studi, riwayat mata kuliah, dan data pribadi Anda pada Program Studi Pendidikan Matematika."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="SKS semester ini"
          value={sksAktif}
          sub={
            jumlahPengajuan > 0
              ? `${krsAktif.length} disetujui · ${jumlahPengajuan} menunggu`
              : `${krsAktif.length} mata kuliah`
          }
          ikon={<BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Total SKS ditempuh"
          value={sksTotal}
          sub={`${mkLulus} mata kuliah lulus`}
          ikon={<Layers className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Angkatan"
          value={mahasiswa.angkatan}
          sub={`Kelas ${mahasiswa.kelasMhs}`}
          ikon={<GraduationCap className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
        <StatCard
          label="Status mahasiswa"
          value={kapital(mahasiswa.status)}
          sub={`Akun ${mahasiswa.user.status}`}
          ikon={<ShieldCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          {semesterAktifRow && <FormPengajuanKrs kelas={kelasTersedia} />}
          <PanelKrs data={daftarSemester} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Profil mahasiswa</CardTitle>
              <p className="text-xs text-fg-muted">
                Data pribadi dan akademik yang tercatat pada SIAKAD.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-base font-semibold text-accent">
                  {inisial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">
                    {mahasiswa.nama}
                  </p>
                  <p className="font-mono-nums text-xs text-fg-muted">
                    NIM {mahasiswa.nim}
                  </p>
                </div>
                <Badge
                  variant={mahasiswa.status === "aktif" ? "success" : "warning"}
                  className="ml-auto"
                >
                  {kapital(mahasiswa.status)}
                </Badge>
              </div>

              <dl className="mt-5 flex flex-col gap-3">
                <Baris
                  label="Email"
                  nilai={
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                      {mahasiswa.user.email}
                    </span>
                  }
                />
                <Baris
                  label="Telepon"
                  nilai={
                    mahasiswa.telepon ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                        {mahasiswa.telepon}
                      </span>
                    ) : (
                      <span className="text-fg-subtle">Belum diisi</span>
                    )
                  }
                />
                <Baris
                  label="Jenis kelamin"
                  nilai={LABEL_JK[mahasiswa.jenisKelamin] ?? mahasiswa.jenisKelamin}
                />
                <Baris
                  label="Tanggal lahir"
                  nilai={
                    mahasiswa.tanggalLahir ? (
                      format(mahasiswa.tanggalLahir, "d MMMM yyyy", {
                        locale: localeId,
                      })
                    ) : (
                      <span className="text-fg-subtle">Belum diisi</span>
                    )
                  }
                  mono={!!mahasiswa.tanggalLahir}
                />
                <Baris label="Kelas" nilai={mahasiswa.kelasMhs} mono />
                <Baris
                  label="Terdaftar sejak"
                  nilai={format(mahasiswa.user.createdAt, "d MMMM yyyy", {
                    locale: localeId,
                  })}
                  mono
                />
                <Baris
                  label="Login terakhir"
                  nilai={
                    mahasiswa.user.lastLoginAt ? (
                      format(mahasiswa.user.lastLoginAt, "d MMM yyyy · HH:mm", {
                        locale: localeId,
                      })
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )
                  }
                  mono
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                Ketentuan akademik
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2.5 text-sm text-fg-muted">
                <li className="flex gap-2.5">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                  Kehadiran minimum <strong className="font-medium text-fg">75%</strong> dari
                  16 pertemuan tiap mata kuliah.
                </li>
                <li className="flex gap-2.5">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                  Nilai akhir = tugas 30% + UTS 30% + UAS 40% (bobot dapat berbeda per kelas).
                </li>
                <li className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                  Pengajuan KRS divalidasi kaprodi; mata kuliah berstatus &ldquo;menunggu validasi&rdquo; sampai disetujui.
                </li>
                <li className="flex gap-2.5">
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                  Nilai dan absensi tidak pernah dihapus — setiap perubahan tercatat.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
