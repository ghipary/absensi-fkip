import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi } from "@/lib/notifikasi";

/**
 * PATCH /api/krs/[id] — kaprodi memvalidasi pengajuan KRS.
 * Body: { aksi: "terima" | "tolak" }
 * - terima → status menjadi "diambil"
 * - tolak  → baris pengajuan dihapus (mahasiswa dapat mengajukan ulang)
 * Keputusan tetap tercatat pada log audit.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
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

  const krs = await prisma.kRS.findUnique({
    where: { id },
    include: {
      mahasiswa: { select: { nama: true, nim: true, userId: true } },
      kelas: {
        select: {
          kodeKelas: true,
          mataKuliah: { select: { kode: true, nama: true } },
        },
      },
    },
  });
  if (!krs) {
    return NextResponse.json({ error: "Pengajuan tidak ditemukan." }, { status: 404 });
  }
  if (krs.status !== "pengajuan") {
    return NextResponse.json(
      { error: "Pengajuan ini sudah diproses sebelumnya." },
      { status: 409 }
    );
  }

  const ringkasMK = `${krs.kelas.mataKuliah.kode} · ${krs.kelas.mataKuliah.nama} (${krs.kelas.kodeKelas})`;

  if (aksi === "terima") {
    await prisma.kRS.update({ where: { id }, data: { status: "diambil" } });
  } else {
    await prisma.kRS.delete({ where: { id } });
  }

  await kirimNotifikasi({
    userIds: [krs.mahasiswa.userId],
    tipe: "sistem",
    judul: aksi === "terima" ? "KRS disetujui" : "KRS ditolak",
    pesan:
      aksi === "terima"
        ? `Pengajuan ${ringkasMK} telah disetujui.`
        : `Pengajuan ${ringkasMK} ditolak. Silakan ajukan mata kuliah lain.`,
    link: "/mahasiswa/profil",
  });

  await catatAudit({
    userId: user.userId,
    aksi: aksi === "terima" ? "approve" : "reject",
    entityType: "krs",
    entityId: id,
    oldValue: { status: "pengajuan", mahasiswa: krs.mahasiswa.nim, kelas: ringkasMK },
    newValue: { status: aksi === "terima" ? "diambil" : "dihapus" },
  });

  return NextResponse.json({ ok: true });
}
