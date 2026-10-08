import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi } from "@/lib/notifikasi";

/**
 * POST /api/tugas/[id]/penilaian — dosen/kaprodi menilai pengumpulan.
 * Body: { penilaian: [{ submissionId, nilai, feedback? }] }
 * Nilai 0–bobotPoin tugas. Menulis juga baris Nilai.komponen tugas (rata-rata ternormalisasi).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const tugas = await prisma.tugas.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { kelas: { select: { id: true, dosenId: true, mataKuliah: true } } },
  });
  if (!tugas) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) {
    return NextResponse.json({ error: "Profil dosen tidak ditemukan." }, { status: 404 });
  }
  if (user.role !== "kaprodi" && tugas.kelas.dosenId !== dosen.id) {
    return NextResponse.json(
      { error: "Anda bukan pengampu kelas ini." },
      { status: 403 }
    );
  }

  let body: {
    penilaian?: { submissionId?: string; nilai?: number; feedback?: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const daftar = body.penilaian;
  if (!Array.isArray(daftar) || daftar.length === 0) {
    return NextResponse.json(
      { error: "Daftar penilaian kosong." },
      { status: 400 }
    );
  }
  if (daftar.length > 200) {
    return NextResponse.json(
      { error: "Terlalu banyak baris dalam satu permintaan." },
      { status: 400 }
    );
  }

  // Validasi seluruh baris dulu — simpan atomik bila semua valid.
  const validasi: { submissionId: string; nilai: number; feedback: string | null }[] = [];
  for (const row of daftar) {
    const id = row.submissionId;
    const nilai = row.nilai;
    if (!id || typeof nilai !== "number" || !Number.isFinite(nilai)) {
      return NextResponse.json(
        { error: "Setiap baris harus punya submissionId dan nilai angka." },
        { status: 400 }
      );
    }
    if (nilai < 0 || nilai > tugas.bobotPoin) {
      return NextResponse.json(
        { error: `Nilai harus antara 0 dan ${tugas.bobotPoin}.` },
        { status: 400 }
      );
    }
    const feedback = row.feedback?.trim() ?? "";
    if (feedback.length > 1000) {
      return NextResponse.json(
        { error: "Feedback maksimal 1000 karakter." },
        { status: 400 }
      );
    }
    validasi.push({ submissionId: id, nilai, feedback: feedback || null });
  }

  // Pastikan semua submission milik tugas ini
  const semua = await prisma.submission.findMany({
    where: { tugasId: tugas.id },
    select: { id: true, mahasiswaId: true, nilai: true },
  });
  const peta = new Map(semua.map((s) => [s.id, s]));
  for (const row of validasi) {
    if (!peta.has(row.submissionId)) {
      return NextResponse.json(
        { error: "Ada submission yang bukan milik tugas ini." },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  const hasil = await prisma.$transaction(async (tx) => {
    for (const row of validasi) {
      await tx.submission.update({
        where: { id: row.submissionId },
        data: {
          nilai: row.nilai,
          feedback: row.feedback,
          dinilaiOlehId: dosen.id,
          dinilaiPada: now,
        },
      });
    }
    // Sinkron komponen "tugas" pada tabel Nilai = rata-rata nilai ternormalisasi.
    // Nilai akhir yang SUDAH FINAL tidak disentuh — dosen harus mengubahnya
    // lewat tabel nilai (yang terekam sebagai riwayat + validasi kaprodi).
    const tugasLain = await tx.tugas.findMany({
      where: { kelasId: tugas.kelas.id, deletedAt: null },
      select: { id: true, bobotPoin: true },
    });
    const berkasPerTugas = new Map(tugasLain.map((t) => [t.id, t.bobotPoin]));
    const semuaSubmission = await tx.submission.findMany({
      where: { tugas: { kelasId: tugas.kelas.id } },
      select: { mahasiswaId: true, tugasId: true, nilai: true },
    });
    const perMahasiswa = new Map<string, number[]>();
    for (const s of semuaSubmission) {
      if (s.nilai === null) continue;
      const poin = berkasPerTugas.get(s.tugasId) ?? 100;
      const persen = Math.min(100, (s.nilai / poin) * 100);
      const arr = perMahasiswa.get(s.mahasiswaId) ?? [];
      arr.push(persen);
      perMahasiswa.set(s.mahasiswaId, arr);
    }
    const yangSudahFinal = await tx.nilai.findMany({
      where: { kelasId: tugas.kelas.id, mahasiswaId: { in: [...perMahasiswa.keys()] } },
      select: { mahasiswaId: true, akhir: true },
    });
    const petaFinal = new Map(yangSudahFinal.map((n) => [n.mahasiswaId, n.akhir !== null]));
    let tertahan = 0;
    for (const [mahasiswaId, nilaiTugas] of perMahasiswa) {
      if (petaFinal.get(mahasiswaId) === true) {
        tertahan++;
        continue; // nilai akhir final — ubah manual lewat tabel nilai
      }
      const rata = Math.round((nilaiTugas.reduce((a, b) => a + b, 0) / nilaiTugas.length) * 10) / 10;
      await tx.nilai.upsert({
        where: { kelasId_mahasiswaId: { kelasId: tugas.kelas.id, mahasiswaId } },
        create: {
          kelasId: tugas.kelas.id,
          mahasiswaId,
          tugas: rata,
          updatedById: dosen.id,
        },
        update: { tugas: rata, updatedById: dosen.id, updatedAt: now },
      });
    }
    return { dinilai: validasi.length, tertahan };
  });

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: "submission",
    entityId: tugas.id,
    newValue: { jumlahDinilai: hasil.dinilai, tertahanNilaiFinal: hasil.tertahan, judul: tugas.judul },
  });

  // Notifikasi ke mahasiswa yang baru dinilai
  const dinilaiIds = validasi.map((v) => peta.get(v.submissionId)!.mahasiswaId);
  const penerima = await prisma.mahasiswa.findMany({
    where: { id: { in: dinilaiIds } },
    select: { userId: true },
  });
  await kirimNotifikasi({
    userIds: penerima.map((m) => m.userId),
    tipe: "nilai",
    judul: `Tugas dinilai: ${tugas.judul}`,
    pesan: `${tugas.kelas.mataKuliah.kode} · ${tugas.kelas.mataKuliah.nama}`,
    link: "/mahasiswa/tugas",
  });

  return NextResponse.json({ ok: true, jumlah: hasil.dinilai, tertahan: hasil.tertahan });
}
