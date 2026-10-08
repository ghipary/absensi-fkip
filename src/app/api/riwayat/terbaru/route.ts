import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hitungAkhir, hitungGrade, snapshotNilai, parseSnapshot } from "@/lib/grade";

/**
 * POST /api/riwayat/terbaru — urungkan perubahan nilai TERAKHIR pada sebuah kelas.
 * Body: { kelasId }
 *
 * Menerapkan logika sama dengan /api/nilai/undo, tetapi menargetkan entri riwayat
 * paling baru pada kelas. Entri yang sudah divalidasi atau tanpa nilai lama dilewati.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: { kelasId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const kelasId = body.kelasId?.trim();
  if (!kelasId) {
    return NextResponse.json({ error: "Kelas wajib dipilih." }, { status: 400 });
  }

  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, deletedAt: null },
    select: { id: true, dosenId: true, bobotTugas: true, bobotUTS: true, bobotUAS: true },
  });
  if (!kelas) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) {
    return NextResponse.json({ error: "Profil dosen tidak ditemukan." }, { status: 404 });
  }
  if (user.role !== "kaprodi" && kelas.dosenId !== dosen.id) {
    return NextResponse.json(
      { error: "Anda bukan pengampu kelas ini." },
      { status: 403 }
    );
  }

  // Cari perubahan terakhir yang masih bisa diurungkan (punya nilai lama)
  const riwayat = await prisma.riwayatPerubahan.findFirst({
    where: { kelasId, tipe: "nilai", nilaiLama: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!riwayat) {
    return NextResponse.json(
      { error: "Belum ada perubahan nilai yang bisa diurungkan." },
      { status: 404 }
    );
  }
  if (riwayat.status === "disetujui" || riwayat.status === "ditolak") {
    return NextResponse.json(
      { error: "Perubahan terakhir sudah divalidasi dan tidak bisa diurungkan." },
      { status: 409 }
    );
  }

  const target = parseSnapshot(riwayat.nilaiLama);
  if (!target || !riwayat.nilaiId) {
    return NextResponse.json(
      { error: "Snapshot nilai sebelumnya tidak terbaca." },
      { status: 500 }
    );
  }

  const nilaiSaatIni = await prisma.nilai.findUnique({ where: { id: riwayat.nilaiId } });
  if (!nilaiSaatIni) {
    return NextResponse.json({ error: "Data nilai tidak ditemukan." }, { status: 404 });
  }

  const bobot = {
    bobotTugas: kelas.bobotTugas,
    bobotUTS: kelas.bobotUTS,
    bobotUAS: kelas.bobotUAS,
  };
  const akhir = hitungAkhir(target.tugas, target.uts, target.uas, bobot);
  const grade = hitungGrade(akhir);
  const dikembalikan = snapshotNilai({
    tugas: target.tugas,
    uts: target.uts,
    uas: target.uas,
    akhir,
    grade,
  });
  const sebelum = snapshotNilai({
    tugas: nilaiSaatIni.tugas,
    uts: nilaiSaatIni.uts,
    uas: nilaiSaatIni.uas,
    akhir: nilaiSaatIni.akhir,
    grade: nilaiSaatIni.grade,
  });
  if (JSON.stringify(dikembalikan) === JSON.stringify(sebelum)) {
    return NextResponse.json(
      { error: "Nilai sudah sama dengan kondisi sebelumnya." },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.nilai.update({
      where: { id: riwayat.nilaiId! },
      data: {
        tugas: dikembalikan.tugas,
        uts: dikembalikan.uts,
        uas: dikembalikan.uas,
        akhir: dikembalikan.akhir,
        grade: grade as never,
        updatedById: dosen.id,
      },
    });
    await tx.riwayatPerubahan.update({
      where: { id: riwayat.id },
      data: { status: "ditolak", reviewedById: user.userId, reviewedAt: new Date() },
    });
    await tx.riwayatPerubahan.create({
      data: {
        tipe: "nilai",
        nilaiId: riwayat.nilaiId,
        kelasId,
        mahasiswaId: riwayat.mahasiswaId,
        field: "akhir",
        nilaiLama: JSON.stringify(sebelum),
        nilaiBaru: JSON.stringify(dikembalikan),
        alasan: "Urungkan perubahan terakhir oleh pengampu",
        diubahOlehId: user.userId,
        status: "otomatis",
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.userId,
        aksi: "update",
        entityType: "nilai",
        entityId: riwayat.nilaiId!,
        oldValue: sebelum as never,
        newValue: dikembalikan as never,
      },
    });
  });

  return NextResponse.json({ ok: true, nilai: dikembalikan });
}
