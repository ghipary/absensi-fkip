import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi } from "@/lib/notifikasi";

/**
 * PATCH /api/surat-izin/[id] — dosen pengampu meninjau surat izin.
 * Body: { aksi: "terima" | "tolak" }
 * - terima → surat disetujui + absensi diubah menjadi izin
 * - tolak  → surat ditolak (absensi tidak berubah)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "dosen") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const dosen = await prisma.dosen.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  if (!dosen) {
    return NextResponse.json({ error: "Profil dosen tidak ditemukan." }, { status: 403 });
  }

  const { id } = await params;
  let body: { aksi?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  const aksi = body.aksi;
  if (aksi !== "terima" && aksi !== "tolak") {
    return NextResponse.json({ error: "Aksi harus terima atau tolak." }, { status: 400 });
  }

  const surat = await prisma.suratIzin.findUnique({
    where: { id },
    include: {
      absensi: {
        include: {
          mahasiswa: { select: { nama: true, nim: true, userId: true } },
          pertemuan: {
            include: {
              kelas: {
                select: {
                  dosenId: true,
                  kodeKelas: true,
                  mataKuliah: { select: { kode: true, nama: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!surat) {
    return NextResponse.json({ error: "Surat tidak ditemukan." }, { status: 404 });
  }
  if (surat.absensi.pertemuan.kelas.dosenId !== dosen.id) {
    return NextResponse.json({ error: "Anda bukan pengampu kelas ini." }, { status: 403 });
  }
  if (surat.status !== "menunggu") {
    return NextResponse.json(
      { error: "Surat ini sudah ditinjau sebelumnya." },
      { status: 409 }
    );
  }

  const kelas = surat.absensi.pertemuan.kelas;
  const ringkas = `${kelas.mataKuliah.kode} · ${kelas.mataKuliah.nama} (${kelas.kodeKelas}) pertemuan ke-${surat.absensi.pertemuan.nomor}`;

  if (aksi === "terima") {
    await prisma.$transaction([
      prisma.suratIzin.update({
        where: { id },
        data: { status: "disetujui", reviewedById: dosen.id },
      }),
      prisma.absensi.update({
        where: { id: surat.absensiId },
        data: { status: "izin" },
      }),
    ]);
  } else {
    await prisma.suratIzin.update({
      where: { id },
      data: { status: "ditolak", reviewedById: dosen.id },
    });
  }

  await kirimNotifikasi({
    userIds: [surat.absensi.mahasiswa.userId],
    tipe: "absensi",
    judul: aksi === "terima" ? "Surat izin disetujui" : "Surat izin ditolak",
    pesan:
      aksi === "terima"
        ? `Surat izin untuk ${ringkas} disetujui; kehadiran tercatat sebagai izin.`
        : `Surat izin untuk ${ringkas} ditolak. Silakan hubungi dosen pengampu.`,
    link: "/mahasiswa/absensi",
  });

  await catatAudit({
    userId: user.userId,
    aksi: aksi === "terima" ? "approve" : "reject",
    entityType: "surat_izin",
    entityId: id,
    oldValue: { status: "menunggu", absensi: surat.absensiId },
    newValue: { status: aksi === "terima" ? "disetujui" : "ditolak" },
  });

  return NextResponse.json({ ok: true });
}
