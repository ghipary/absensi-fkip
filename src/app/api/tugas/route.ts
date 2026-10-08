import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi, userIdPesertaKelas } from "@/lib/notifikasi";

/**
 * POST /api/tugas — dosen/kaprodi membuat tugas baru untuk satu kelas.
 * Body: { kelasId, judul, deskripsi, deadlineAt, bobotPoin?, langsungTerbit? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    kelasId?: string;
    judul?: string;
    deskripsi?: string;
    deadlineAt?: string;
    bobotPoin?: number;
    langsungTerbit?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const kelasId = body.kelasId?.trim();
  const judul = body.judul?.trim();
  const deskripsi = body.deskripsi?.trim();
  const bobotPoin = typeof body.bobotPoin === "number" ? body.bobotPoin : 100;

  if (!kelasId || !judul) {
    return NextResponse.json(
      { error: "Kelas dan judul tugas wajib diisi." },
      { status: 400 }
    );
  }
  if (judul.length < 3 || judul.length > 160) {
    return NextResponse.json(
      { error: "Judul tugas harus 3–160 karakter." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(bobotPoin) || bobotPoin < 1 || bobotPoin > 1000) {
    return NextResponse.json(
      { error: "Bobot poin harus antara 1 dan 1000." },
      { status: 400 }
    );
  }

  const deadline = body.deadlineAt ? new Date(body.deadlineAt) : null;
  if (!deadline || Number.isNaN(deadline.getTime())) {
    return NextResponse.json(
      { error: "Tenggat waktu tidak valid." },
      { status: 400 }
    );
  }
  if (deadline.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return NextResponse.json(
      { error: "Tenggat tidak boleh jauh di masa lalu." },
      { status: 400 }
    );
  }

  // Klasifikasi kepemilikan kelas (dosen pengampu vs kaprodi operator)
  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, deletedAt: null },
    include: {
      mataKuliah: { select: { kode: true, nama: true } },
      dosen: { select: { id: true, userId: true, nama: true } },
    },
  });
  if (!kelas) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) {
    return NextResponse.json(
      { error: "Profil dosen tidak ditemukan." },
      { status: 404 }
    );
  }
  if (user.role !== "kaprodi" && kelas.dosenId !== dosen.id) {
    return NextResponse.json(
      { error: "Anda bukan pengampu kelas ini." },
      { status: 403 }
    );
  }

  const tugas = await prisma.tugas.create({
    data: {
      kelasId: kelas.id,
      judul,
      deskripsi: deskripsi ?? "",
      deadlineAt: deadline,
      bobotPoin: Math.round(bobotPoin),
      createdById: dosen.id,
      publishedAt: body.langsungTerbit === false ? null : new Date(),
    },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "tugas",
    entityId: tugas.id,
    newValue: { judul, kelasId: kelas.id, deadlineAt: deadline.toISOString() },
  });

  // Beritahu semua mahasiswa peserta kelas
  if (tugas.publishedAt) {
    const userIds = await userIdPesertaKelas(kelas.id);
    await kirimNotifikasi({
      userIds,
      tipe: "tugas",
      judul: `Tugas baru: ${tugas.judul}`,
      pesan: `${kelas.mataKuliah.kode} · ${kelas.mataKuliah.nama} · tenggat ${deadline.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`,
      link: "/mahasiswa/tugas",
    });
  }

  return NextResponse.json({ ok: true, tugas }, { status: 201 });
}
