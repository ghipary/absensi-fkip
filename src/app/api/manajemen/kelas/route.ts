import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { hitungJejakKelas, validasiJadwal, type JadwalInput } from "@/lib/kelas";

/**
 * POST /api/manajemen/kelas — kaprodi membuka kelas baru: mengaitkan satu mata
 * kuliah pada satu semester dengan seorang dosen pengampu (assign).
 * Body: { mkId, semesterId, dosenId, kodeKelas?, kapasitas?, jadwal? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    mkId?: string;
    semesterId?: string;
    dosenId?: string;
    kodeKelas?: string;
    kapasitas?: number;
    jadwal?: JadwalInput | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const mkId = body.mkId?.trim();
  const semesterId = body.semesterId?.trim();
  const dosenId = body.dosenId?.trim();
  const kodeKelas = (body.kodeKelas?.trim() || "A").toUpperCase();
  const kapasitas = body.kapasitas === undefined ? 40 : Number(body.kapasitas);

  if (!mkId || !semesterId || !dosenId) {
    return NextResponse.json(
      { error: "Mata kuliah, semester, dan dosen pengampu wajib dipilih." },
      { status: 400 }
    );
  }
  if (!/^[A-Z0-9-]{1,10}$/.test(kodeKelas)) {
    return NextResponse.json(
      { error: "Kode kelas 1–10 karakter (huruf/angka/tanda hubung)." },
      { status: 400 }
    );
  }
  if (!Number.isInteger(kapasitas) || kapasitas < 1 || kapasitas > 200) {
    return NextResponse.json({ error: "Kapasitas harus angka 1–200." }, { status: 400 });
  }

  const [mk, semester, dosen] = await Promise.all([
    prisma.mataKuliah.findFirst({
      where: { id: mkId, deletedAt: null },
      select: { id: true, kode: true },
    }),
    prisma.semester.findUnique({ where: { id: semesterId }, select: { id: true } }),
    prisma.dosen.findUnique({ where: { id: dosenId }, select: { id: true } }),
  ]);
  if (!mk) {
    return NextResponse.json(
      { error: "Mata kuliah tidak ditemukan atau nonaktif." },
      { status: 404 }
    );
  }
  if (!semester) {
    return NextResponse.json({ error: "Semester tidak ditemukan." }, { status: 404 });
  }
  if (!dosen) {
    return NextResponse.json({ error: "Dosen pengampu tidak ditemukan." }, { status: 404 });
  }

  const jadwal = validasiJadwal(body.jadwal);
  if (jadwal.error) {
    return NextResponse.json({ error: jadwal.error }, { status: 400 });
  }

  const bentrok = await prisma.kelas.findFirst({
    where: { mkId, semesterId, kodeKelas },
    select: { id: true, deletedAt: true },
  });
  if (bentrok) {
    if (bentrok.deletedAt === null) {
      return NextResponse.json(
        { error: `Kelas ${kodeKelas} untuk mata kuliah ini sudah ada pada semester tersebut.` },
        { status: 409 }
      );
    }
    // Baris arsip dari kelas yang pernah dihapus: pakai ulang bila tanpa jejak.
    const jejak = await hitungJejakKelas(bentrok.id);
    if (jejak > 0) {
      return NextResponse.json(
        {
          error:
            `Kelas ${kodeKelas} pernah dihapus namun menyisakan riwayat akademik. ` +
            `Pilih kode kelas lain.`,
        },
        { status: 409 }
      );
    }
    await prisma.kelas.delete({ where: { id: bentrok.id } });
  }

  const kelas = await prisma.kelas.create({
    data: {
      mkId,
      semesterId,
      dosenId,
      kodeKelas,
      kapasitas,
      jadwal: jadwal.data ? { create: jadwal.data } : undefined,
    },
    select: { id: true, kodeKelas: true },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "kelas",
    entityId: kelas.id,
    newValue: {
      mkId,
      mkKode: mk.kode,
      semesterId,
      dosenId,
      kodeKelas,
      kapasitas,
      jadwal: jadwal.data ?? null,
    },
  });

  return NextResponse.json({ ok: true, kelas }, { status: 201 });
}
