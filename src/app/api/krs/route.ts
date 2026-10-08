import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi } from "@/lib/notifikasi";

/**
 * POST /api/krs — mahasiswa mengajukan KRS untuk kelas pada semester aktif.
 * Baris dibuat dengan status "pengajuan" dan menunggu keputusan kaprodi.
 * Body: { kelasIds: string[] }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
    select: { id: true, nama: true, nim: true },
  });
  if (!mahasiswa) {
    return NextResponse.json({ error: "Profil mahasiswa tidak ditemukan." }, { status: 403 });
  }

  let body: { kelasIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const ids = Array.isArray(body.kelasIds)
    ? [...new Set(body.kelasIds.filter((x): x is string => typeof x === "string" && x.length > 0))]
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Pilih minimal satu mata kuliah." }, { status: 400 });
  }
  if (ids.length > 12) {
    return NextResponse.json({ error: "Maksimal 12 mata kuliah per pengajuan." }, { status: 400 });
  }

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });
  if (!semesterAktif) {
    return NextResponse.json({ error: "Belum ada semester aktif." }, { status: 400 });
  }

  const kelas = await prisma.kelas.findMany({
    where: { id: { in: ids }, semesterId: semesterAktif.id, deletedAt: null },
    select: { id: true },
  });
  if (kelas.length !== ids.length) {
    return NextResponse.json(
      { error: "Sebagian kelas tidak tersedia pada semester aktif." },
      { status: 400 }
    );
  }

  const existing = await prisma.kRS.findMany({
    where: { mahasiswaId: mahasiswa.id, kelasId: { in: ids } },
    select: { id: true, kelasId: true, status: true },
  });
  const petaAda = new Map(existing.map((e) => [e.kelasId, e]));

  let diajukan = 0;
  await prisma.$transaction(async (tx) => {
    for (const kelasId of ids) {
      const ada = petaAda.get(kelasId);
      if (!ada) {
        await tx.kRS.create({
          data: { kelasId, mahasiswaId: mahasiswa.id, status: "pengajuan" },
        });
        diajukan++;
      } else if (ada.status === "drop") {
        await tx.kRS.update({ where: { id: ada.id }, data: { status: "pengajuan" } });
        diajukan++;
      }
    }
  });

  if (diajukan === 0) {
    return NextResponse.json(
      { error: "Mata kuliah yang dipilih sudah diambil atau sedang menunggu validasi." },
      { status: 409 }
    );
  }

  const kaprodi = await prisma.user.findMany({
    where: { role: "kaprodi", status: "aktif" },
    select: { id: true },
  });
  await kirimNotifikasi({
    userIds: kaprodi.map((k) => k.id),
    tipe: "sistem",
    judul: "Pengajuan KRS baru",
    pesan: `${mahasiswa.nama} (${mahasiswa.nim}) mengajukan ${diajukan} mata kuliah untuk divalidasi.`,
    link: "/kaprodi/manajemen",
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "krs",
    entityId: mahasiswa.id,
    newValue: { diajukan, kelasIds: ids },
  });

  return NextResponse.json({ ok: true, diajukan }, { status: 201 });
}
