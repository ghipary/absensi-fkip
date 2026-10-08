import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import type { TipeKalender } from "@prisma/client";

const TIPE_VALID: TipeKalender[] = ["libur", "ujian", "event"];

/**
 * POST /api/kalender — kaprodi menambah agenda kalender akademik pada semester aktif.
 * Body: { tanggal, tipe, judul, deskripsi? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: { tanggal?: string; tipe?: TipeKalender; judul?: string; deskripsi?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const judul = body.judul?.trim();
  const deskripsi = body.deskripsi?.trim() || null;
  const tipe = body.tipe;
  const tanggal = body.tanggal ? new Date(body.tanggal) : new Date();

  if (!judul || judul.length < 3 || judul.length > 120) {
    return NextResponse.json({ error: "Judul agenda harus 3–120 karakter." }, { status: 400 });
  }
  if (!tipe || !TIPE_VALID.includes(tipe)) {
    return NextResponse.json({ error: "Tipe agenda tidak valid." }, { status: 400 });
  }
  if (Number.isNaN(tanggal.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });
  if (!semesterAktif) {
    return NextResponse.json({ error: "Belum ada semester aktif." }, { status: 400 });
  }

  const agenda = await prisma.kalenderAkademik.create({
    data: { semesterId: semesterAktif.id, tanggal, tipe, judul, deskripsi },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "kalender_akademik",
    entityId: agenda.id,
    newValue: { tanggal: tanggal.toISOString(), tipe, judul },
  });

  return NextResponse.json({ ok: true, agenda }, { status: 201 });
}
