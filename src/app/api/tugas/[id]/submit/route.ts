import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/**
 * POST /api/tugas/[id]/submit — mahasiswa mengumpulkan tugas (teks dan/atau tautan).
 * Boleh diperbarui selama belum dinilai. Status terlambat dihitung dari tenggat.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
  });
  if (!mahasiswa) {
    return NextResponse.json({ error: "Profil mahasiswa tidak ditemukan." }, { status: 404 });
  }

  const tugas = await prisma.tugas.findFirst({
    where: { id: params.id, deletedAt: null },
    include: { kelas: { select: { id: true, dosenId: true, mataKuliah: true } } },
  });
  if (!tugas) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  if (!tugas.publishedAt) {
    return NextResponse.json({ error: "Tugas belum dipublikasikan." }, { status: 403 });
  }

  // Wajib ber-KRS aktif di kelas
  const krs = await prisma.kRS.findFirst({
    where: { kelasId: tugas.kelas.id, mahasiswaId: mahasiswa.id, status: "diambil" },
  });
  if (!krs) {
    return NextResponse.json(
      { error: "Anda tidak terdaftar pada kelas ini." },
      { status: 403 }
    );
  }

  let body: { teks?: string; linkUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const teks = body.teks?.trim() ?? "";
  const linkUrl = body.linkUrl?.trim() ?? "";

  if (!teks && !linkUrl) {
    return NextResponse.json(
      { error: "Isi jawaban atau tautan sebelum mengumpulkan." },
      { status: 400 }
    );
  }
  if (teks.length > 5000) {
    return NextResponse.json(
      { error: "Jawaban teks maksimal 5000 karakter." },
      { status: 400 }
    );
  }
  if (linkUrl && !/^https?:\/\/\S+$/i.test(linkUrl)) {
    return NextResponse.json(
      { error: "Tautan harus diawali http:// atau https://." },
      { status: 400 }
    );
  }

  const lama = await prisma.submission.findUnique({
    where: { tugasId_mahasiswaId: { tugasId: tugas.id, mahasiswaId: mahasiswa.id } },
  });
  if (lama?.nilai !== null && lama?.nilai !== undefined) {
    return NextResponse.json(
      { error: "Tugas sudah dinilai dan tidak bisa diubah. Hubungi dosen bila ada masalah." },
      { status: 409 }
    );
  }

  const now = new Date();
  const data = {
    teks: teks || null,
    linkUrl: linkUrl || null,
    submittedAt: now,
    isTerlambat: now.getTime() > tugas.deadlineAt.getTime(),
  };

  const submission = lama
    ? await prisma.submission.update({ where: { id: lama.id }, data })
    : await prisma.submission.create({
        data: { ...data, tugasId: tugas.id, mahasiswaId: mahasiswa.id },
      });

  await catatAudit({
    userId: user.userId,
    aksi: lama ? "update" : "create",
    entityType: "submission",
    entityId: submission.id,
    oldValue: lama ? { teks: lama.teks, linkUrl: lama.linkUrl } : undefined,
    newValue: { teks: data.teks, linkUrl: data.linkUrl, isTerlambat: data.isTerlambat },
  });

  return NextResponse.json(
    { ok: true, submission, isTerlambat: data.isTerlambat },
    { status: lama ? 200 : 201 }
  );
}
