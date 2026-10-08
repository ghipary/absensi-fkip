import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi, userIdPesertaKelas } from "@/lib/notifikasi";
import type { CakupanPengumuman } from "@prisma/client";

/**
 * POST /api/pengumuman — dosen/kaprodi menerbitkan pengumuman.
 * Body: { judul, konten, cakupan: "prodi"|"kelas", kelasId? }
 *
 * GET /api/pengumuman — daftar pengumuman sesuai peran:
 * - mahasiswa: prodi + kelas yang sedang ia tempuh
 * - dosen: prodi + kelas yang ia ampu + buatannya sendiri
 * - kaprodi: semua
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
  }

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });
  if (!semesterAktif) {
    return NextResponse.json({ daftar: [] });
  }

  let daftar;
  if (user.role === "kaprodi") {
    daftar = await prisma.pengumuman.findMany({
      where: {
        OR: [{ semesterId: semesterAktif.id }, { semesterId: null }],
      },
      orderBy: { publishedAt: "desc" },
      include: {
        pembuat: { select: { email: true, dosen: { select: { nama: true } } } },
        kelas: { select: { kodeKelas: true, mataKuliah: { select: { kode: true, nama: true } } } },
        semester: { select: { nama: true, tahun: { select: { nama: true } } } },
      },
    });
  } else if (user.role === "dosen") {
    const dosen = await prisma.dosen.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    daftar = await prisma.pengumuman.findMany({
      where: {
        OR: [
          { semesterId: semesterAktif.id, cakupan: "prodi" },
          {
            semesterId: semesterAktif.id,
            kelas: dosen ? { dosenId: dosen.id } : {},
          },
          { createdById: user.userId },
        ],
      },
      orderBy: { publishedAt: "desc" },
      include: {
        pembuat: { select: { email: true, dosen: { select: { nama: true } } } },
        kelas: { select: { kodeKelas: true, mataKuliah: { select: { kode: true, nama: true } } } },
        semester: { select: { nama: true, tahun: { select: { nama: true } } } },
      },
    });
  } else {
    // mahasiswa: prodi + kelas yang sedang diambil
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    const kelasDiambil = mahasiswa
      ? (
          await prisma.kRS.findMany({
            where: { mahasiswaId: mahasiswa.id, status: "diambil" },
            select: { kelasId: true },
          })
        ).map((k) => k.kelasId)
      : [];
    daftar = await prisma.pengumuman.findMany({
      where: {
        semesterId: semesterAktif.id,
        OR: [
          { cakupan: "prodi" },
          { cakupan: "kelas", kelasId: { in: kelasDiambil } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      include: {
        pembuat: { select: { email: true, dosen: { select: { nama: true } } } },
        kelas: { select: { kodeKelas: true, mataKuliah: { select: { kode: true, nama: true } } } },
        semester: { select: { nama: true, tahun: { select: { nama: true } } } },
      },
    });
  }

  return NextResponse.json({ daftar });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    judul?: string;
    konten?: string;
    cakupan?: CakupanPengumuman;
    kelasId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const judul = body.judul?.trim();
  const konten = body.konten?.trim();
  const cakupan = body.cakupan;
  const kelasId = body.kelasId?.trim();

  if (!judul || !konten) {
    return NextResponse.json(
      { error: "Judul dan isi pengumuman wajib diisi." },
      { status: 400 }
    );
  }
  if (judul.length < 3 || judul.length > 160) {
    return NextResponse.json(
      { error: "Judul pengumuman harus 3–160 karakter." },
      { status: 400 }
    );
  }
  if (konten.length < 5) {
    return NextResponse.json(
      { error: "Isi pengumuman terlalu pendek." },
      { status: 400 }
    );
  }
  if (cakupan !== "prodi" && cakupan !== "kelas") {
    return NextResponse.json(
      { error: "Cakupan harus 'prodi' atau 'kelas'." },
      { status: 400 }
    );
  }
  if (cakupan === "kelas" && !kelasId) {
    return NextResponse.json(
      { error: "Pengumuman kelas wajib memilih kelas." },
      { status: 400 }
    );
  }

  let kelas = null;
  if (cakupan === "kelas") {
    kelas = await prisma.kelas.findFirst({
      where: { id: kelasId, deletedAt: null },
      include: {
        mataKuliah: { select: { kode: true, nama: true } },
        dosen: { select: { id: true, nama: true } },
      },
    });
    if (!kelas) {
      return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
    }
    if (user.role === "dosen") {
      const dosen = await prisma.dosen.findUnique({
        where: { userId: user.userId },
        select: { id: true },
      });
      if (!dosen || dosen.id !== kelas.dosenId) {
        return NextResponse.json(
          { error: "Anda bukan pengampu kelas ini." },
          { status: 403 }
        );
      }
    }
  }

  const semesterAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });

  const pengumuman = await prisma.pengumuman.create({
    data: {
      judul,
      konten,
      cakupan,
      kelasId: kelas?.id ?? null,
      semesterId: cakupan === "kelas" ? kelas?.semesterId : semesterAktif?.id ?? null,
      createdById: user.userId,
    },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "pengumuman",
    entityId: pengumuman.id,
    newValue: { judul, cakupan, kelasId: kelas?.id ?? null },
  });

  // Notifikasi penerima
  const penerima =
    cakupan === "kelas" && kelas
      ? await userIdPesertaKelas(kelas.id)
      : (
          await prisma.mahasiswa.findMany({
            where: { status: "aktif" },
            select: { userId: true },
          })
        ).map((m) => m.userId);

  await kirimNotifikasi({
    userIds: penerima,
    tipe: "pengumuman",
    judul: `Pengumuman: ${pengumuman.judul}`,
    pesan:
      cakupan === "kelas" && kelas
        ? `${kelas.mataKuliah.kode} · Kelas ${kelas.kodeKelas}`
        : "Informasi resmi Program Studi Pendidikan Matematika.",
    link: "/mahasiswa/pengumuman",
  });

  return NextResponse.json({ ok: true, pengumuman }, { status: 201 });
}