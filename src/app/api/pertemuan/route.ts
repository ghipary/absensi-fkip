import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/**
 * POST /api/pertemuan — dosen menambah pertemuan pada kelas yang diampu.
 * Nomor pertemuan ditentukan otomatis (max + 1).
 * Body: { kelasId, tanggal?, topik? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "dosen") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) {
    return NextResponse.json({ error: "Profil dosen tidak ditemukan." }, { status: 403 });
  }

  let body: { kelasId?: string; tanggal?: string; topik?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const kelasId = body.kelasId?.trim();
  const topik = body.topik?.trim() || null;
  if (!kelasId) {
    return NextResponse.json({ error: "Kelas tidak diketahui." }, { status: 400 });
  }

  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    select: { id: true, dosenId: true, deletedAt: true, mataKuliah: { select: { nama: true } } },
  });
  if (!kelas || kelas.deletedAt) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }
  if (kelas.dosenId !== dosen.id) {
    return NextResponse.json({ error: "Anda bukan pengampu kelas ini." }, { status: 403 });
  }

  const tanggal = body.tanggal ? new Date(body.tanggal) : new Date();
  if (Number.isNaN(tanggal.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }
  if (topik && topik.length > 200) {
    return NextResponse.json({ error: "Topik maksimal 200 karakter." }, { status: 400 });
  }

  const terakhir = await prisma.pertemuan.aggregate({
    where: { kelasId },
    _max: { nomor: true },
  });
  const nomor = (terakhir._max.nomor ?? 0) + 1;

  const pertemuan = await prisma.pertemuan.create({
    data: { kelasId, nomor, tanggal, topik },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "pertemuan",
    entityId: pertemuan.id,
    newValue: { kelasId, nomor, tanggal: tanggal.toISOString(), topik },
  });

  return NextResponse.json({ ok: true, pertemuan }, { status: 201 });
}
