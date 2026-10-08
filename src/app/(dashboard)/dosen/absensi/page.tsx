import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { QrCode } from "lucide-react";
import { PanelSesi } from "./panel-sesi";
import { PanelSuratIzin } from "./panel-surat-izin";

export const metadata: Metadata = { title: "Kelola Absensi" };

export default async function HalamanAbsensiDosen({
  searchParams,
}: {
  searchParams: { kelas?: string; pertemuan?: string };
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    redirect("/login");
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) redirect("/login");

  const semesterAktif = await prisma.semester.findFirst({ where: { isAktif: true } });

  // Kelas yang diampu
  const daftarKelas = semesterAktif
    ? await prisma.kelas.findMany({
        where: { dosenId: dosen.id, semesterId: semesterAktif.id, deletedAt: null },
        include: {
          mataKuliah: true,
          jadwal: true,
          pertemuan: {
            orderBy: { nomor: "asc" },
            include: {
              sesiAbsensi: { where: { status: "terbuka" }, take: 1 },
              _count: { select: { absensi: true } },
            },
          },
          _count: { select: { krs: { where: { status: "diambil" } } } },
        },
        orderBy: { mataKuliah: { kode: "asc" } },
      })
    : [];

  const kelasTerpilih =
    daftarKelas.find((k) => k.id === searchParams.kelas) ?? daftarKelas[0];

  const pertemuanTerpilih = kelasTerpilih
    ? kelasTerpilih.pertemuan.find((p) => p.id === searchParams.pertemuan) ??
      kelasTerpilih.pertemuan.find((p) => p.sesiAbsensi.length > 0) ??
      kelasTerpilih.pertemuan.find((p) => p._count.absensi === 0) ??
      kelasTerpilih.pertemuan[kelasTerpilih.pertemuan.length - 1]
    : undefined;

  const riwayatSesi = kelasTerpilih
    ? await prisma.sesiAbsensi.findMany({
        where: { kelasId: kelasTerpilih.id },
        orderBy: { openedAt: "desc" },
        take: 5,
        include: {
          pertemuan: true,
          _count: { select: { absensi: true } },
        },
      })
    : [];

  const suratMenunggu = await prisma.suratIzin.findMany({
    where: {
      status: "menunggu",
      absensi: { pertemuan: { kelas: { dosenId: dosen.id } } },
    },
    include: {
      absensi: {
        include: {
          mahasiswa: { select: { nama: true, nim: true } },
          pertemuan: {
            include: {
              kelas: {
                include: { mataKuliah: { select: { kode: true, nama: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <>
      <PageHeader
        judul="Kelola Absensi"
        deskripsi="Buka sesi QR/kode unik, pantau check-in real-time, dan lakukan absen manual untuk mahasiswa izin atau sakit."
      />

      {!kelasTerpilih ? (
        <Card>
          <EmptyState
            icon={QrCode}
            judul="Belum ada kelas yang diampu"
            deskripsi="Anda belum ditugaskan mengampu mata kuliah pada semester ini. Hubungi kaprodi untuk penugasan."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Panel utama sesi — 7 kolom */}
          <div className="lg:col-span-7">
            <PanelSesi
              daftarKelas={daftarKelas.map((k) => ({
                id: k.id,
                kode: k.mataKuliah.kode,
                nama: k.mataKuliah.nama,
                kodeKelas: k.kodeKelas,
                jumlahMhs: k._count.krs,
                jadwal: k.jadwal.map((j) => ({
                  hari: j.hari,
                  jam: `${j.jamMulai}–${j.jamSelesai}`,
                  ruang: j.ruang,
                })),
                pertemuan: k.pertemuan.map((p) => ({
                  id: p.id,
                  nomor: p.nomor,
                  tanggal: p.tanggal.toISOString(),
                  jumlahAbsen: p._count.absensi,
                  sesiTerbuka: p.sesiAbsensi.length > 0,
                })),
              }))}
              kelasIdAwal={kelasTerpilih.id}
              pertemuanIdAwal={pertemuanTerpilih?.id ?? null}
              namaDosen={dosen.nama}
            />
          </div>

          {/* Riwayat sesi — 5 kolom */}
          <div className="flex flex-col gap-4 lg:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Sesi absensi terakhir</CardTitle>
                <p className="text-xs text-fg-muted">
                  {kelasTerpilih.mataKuliah.nama} · Kelas{" "}
                  {kelasTerpilih.kodeKelas}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {riwayatSesi.length === 0 ? (
                  <EmptyState
                    compact
                    icon={QrCode}
                    judul="Belum ada sesi dibuka"
                    deskripsi="Sesi absensi yang Anda buka akan tercatat di sini."
                  />
                ) : (
                  riwayatSesi.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">
                          Pertemuan ke-{s.pertemuan.nomor}
                        </p>
                        <p className="font-mono-nums text-xs text-fg-muted">
                          {format(s.openedAt, "d MMM HH:mm", { locale: localeId })} ·
                          kode {s.kodeUnik}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono-nums text-sm font-semibold text-fg">
                          {s._count.absensi}
                        </p>
                        <p
                          className={
                            s.status === "terbuka"
                              ? "text-2xs font-medium text-success-text"
                              : "text-2xs text-fg-subtle"
                          }
                        >
                          {s.status === "terbuka" ? "aktif" : "ditutup"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <PanelSuratIzin
              daftar={suratMenunggu.map((s) => ({
                id: s.id,
                mahasiswa: s.absensi.mahasiswa.nama,
                nim: s.absensi.mahasiswa.nim,
                mk: `${s.absensi.pertemuan.kelas.mataKuliah.kode} · ${s.absensi.pertemuan.kelas.mataKuliah.nama}`,
                pertemuan: s.absensi.pertemuan.nomor,
                tanggal: format(s.absensi.pertemuan.tanggal, "d MMM yyyy", { locale: localeId }),
                keterangan: s.keterangan,
                filePath: s.filePath,
              }))}
            />

            <Card>
              <CardHeader>
                <CardTitle>Cara menggelar absensi</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-2.5 text-sm text-fg-muted">
                  {[
                    "Pilih kelas dan nomor pertemuan yang berlangsung hari ini.",
                    "Tentukan masa berlaku (1–60 menit) dan aktifkan lokasi bila ingin memastikan mahasiswa di ruang kelas.",
                    "Tampilkan QR di layar, atau bacakan kode unik 6 digit untuk absensi manual.",
                    "Pantau daftar hadir yang masuk, lalu tutup sesi setelah kelas selesai.",
                  ].map((teks, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border border-border font-mono-nums text-2xs font-semibold text-fg-muted">
                        {i + 1}
                      </span>
                      <span>{teks}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
