import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hitungAkhir, hitungGrade, snapshotNilai, parseSnapshot } from "@/lib/grade";

/**
 * POST /api/nilai/undo — mengembalikan satu nilai ke kondisi sebelum perubahan.
 * Body: { riwayatId }
 *
 * Hanya bisa diurungkan bila entri riwayat punya nilaiLama (bukan input pertama)
 * dan merupakan perubahan TERAKHIR untuk nilai tersebut (bila sudah ada perubahan
 * lebih baru, ditolak agar riwayat tetap konsisten).
 * Pengurungan sendiri dicatat sebagai riwayat baru — riwayat tidak pernah dihapus.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: { riwayatId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const riwayatId = body.riwayatId?.trim();
  if (!riwayatId) {
    return NextResponse.json({ error: "Entri riwayat tidak valid." }, { status: 400 });
  }

  const riwayat = await prisma.riwayatPerubahan.findUnique({
    where: { id: riwayatId },
    include: { nilai: { include: { kelas: { select: { dosenId: true, bobotTugas: true, bobotUTS: true, bobotUAS: true, mataKuliah: { select: { kode: true, nama: true } } } } } } },
  });

  if (!riwayat || riwayat.tipe !== "nilai" || !riwayat.nilai || !riwayat.nilaiLama) {
    return NextResponse.json(
      { error: "Perubahan ini tidak bisa diurungkan (tidak ada nilai sebelumnya)." },
      { status: 400 }
    );
  }
  if (riwayat.status === "disetujui" || riwayat.status === "ditolak") {
    return NextResponse.json(
      { error: "Perubahan yang sudah divalidasi tidak bisa diurungkan dosen." },
      { status: 409 }
    );
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) {
    return NextResponse.json({ error: "Profil dosen tidak ditemukan." }, { status: 404 });
  }
  if (user.role !== "kaprodi" && riwayat.nilai.kelas.dosenId !== dosen.id) {
    return NextResponse.json(
      { error: "Anda bukan pengampu kelas ini." },
      { status: 403 }
    );
  }

  // Hanya perubahan terakhir untuk nilai ini yang boleh diurungkan
  const terakhir = await prisma.riwayatPerubahan.findFirst({
    where: { nilaiId: riwayat.nilaiId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!terakhir || terakhir.id !== riwayat.id) {
    return NextResponse.json(
      { error: "Sudah ada perubahan lebih baru — urungkan yang terbaru lebih dulu." },
      { status: 409 }
    );
  }

  const target = parseSnapshot(riwayat.nilaiLama);
  if (!target) {
    return NextResponse.json(
      { error: "Snapshot nilai sebelumnya tidak terbaca." },
      { status: 500 }
    );
  }

  const bobot = {
    bobotTugas: riwayat.nilai.kelas.bobotTugas,
    bobotUTS: riwayat.nilai.kelas.bobotUTS,
    bobotUAS: riwayat.nilai.kelas.bobotUAS,
  };
  // Hitung ulang dari komponen lama agar konsisten dengan bobot kelas saat ini
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
    tugas: riwayat.nilai.tugas,
    uts: riwayat.nilai.uts,
    uas: riwayat.nilai.uas,
    akhir: riwayat.nilai.akhir,
    grade: riwayat.nilai.grade,
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
    // Tandai perubahan yang diurungkan sebagai ditolak (sudah dibatalkan)
    await tx.riwayatPerubahan.update({
      where: { id: riwayat.id },
      data: { status: "ditolak", reviewedById: user.userId, reviewedAt: new Date() },
    });
    await tx.riwayatPerubahan.create({
      data: {
        tipe: "nilai",
        nilaiId: riwayat.nilaiId!,
        kelasId: riwayat.kelasId,
        mahasiswaId: riwayat.mahasiswaId,
        field: "akhir",
        nilaiLama: JSON.stringify(sebelum),
        nilaiBaru: JSON.stringify(dikembalikan),
        alasan: "Urungkan perubahan manual oleh pengampu",
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
