import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi, userIdPesertaKelas } from "@/lib/notifikasi";

/**
 * PATCH /api/tugas/[id] — dosen/kaprodi mengubah tugas.
 * Body: { judul?, deskripsi?, deadlineAt?, bobotPoin?, aksi?: "terbit" | "tarik" | "hapus" }
 * - terbit: publishedAt null → sekarang (mahasiswa langsung melihat)
 * - tarik:  publishedAt → null (kembali jadi draf)
 * - hapus:  soft delete (deletedAt)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    judul?: string;
    deskripsi?: string;
    deadlineAt?: string;
    bobotPoin?: number;
    aksi?: "terbit" | "tarik" | "hapus";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const tugas = await prisma.tugas.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      kelas: {
        select: {
          id: true,
          dosenId: true,
          mataKuliah: { select: { kode: true, nama: true } },
        },
      },
    },
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

  // Aksi status
  if (body.aksi === "hapus") {
    const adaKumpul = await prisma.submission.count({
      where: { tugasId: tugas.id, nilai: { not: null } },
    });
    if (adaKumpul > 0) {
      return NextResponse.json(
        { error: "Tugas sudah ada yang dinilai — tidak bisa dihapus. Tarik saja publikasinya." },
        { status: 409 }
      );
    }
    await prisma.tugas.update({
      where: { id: tugas.id },
      data: { deletedAt: new Date() },
    });
    await catatAudit({
      userId: user.userId,
      aksi: "delete",
      entityType: "tugas",
      entityId: tugas.id,
      oldValue: { judul: tugas.judul, publishedAt: tugas.publishedAt },
    });
    return NextResponse.json({ ok: true, aksi: "hapus" });
  }

  if (body.aksi === "tarik") {
    await prisma.tugas.update({
      where: { id: tugas.id },
      data: { publishedAt: null },
    });
    await catatAudit({
      userId: user.userId,
      aksi: "update",
      entityType: "tugas",
      entityId: tugas.id,
      oldValue: { publishedAt: tugas.publishedAt },
      newValue: { publishedAt: null },
    });
    return NextResponse.json({ ok: true, aksi: "tarik" });
  }

  // Perubahan konten
  const data: Record<string, unknown> = {};
  if (body.judul !== undefined) {
    const judul = body.judul.trim();
    if (judul.length < 3 || judul.length > 160) {
      return NextResponse.json(
        { error: "Judul tugas harus 3–160 karakter." },
        { status: 400 }
      );
    }
    data.judul = judul;
  }
  if (body.deskripsi !== undefined) data.deskripsi = body.deskripsi.trim();
  if (body.deadlineAt !== undefined) {
    const d = new Date(body.deadlineAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Tenggat waktu tidak valid." },
        { status: 400 }
      );
    }
    data.deadlineAt = d;
  }
  if (body.bobotPoin !== undefined) {
    if (
      !Number.isFinite(body.bobotPoin) ||
      body.bobotPoin < 1 ||
      body.bobotPoin > 1000
    ) {
      return NextResponse.json(
        { error: "Bobot poin harus antara 1 dan 1000." },
        { status: 400 }
      );
    }
    data.bobotPoin = Math.round(body.bobotPoin);
  }

  const sebelumDipublikasikan = tugas.publishedAt !== null;
  if (body.aksi === "terbit" && !sebelumDipublikasikan) {
    data.publishedAt = new Date();
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  const updated = await prisma.tugas.update({
    where: { id: tugas.id },
    data,
  });

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: "tugas",
    entityId: tugas.id,
    oldValue: {
      judul: tugas.judul,
      deadlineAt: tugas.deadlineAt.toISOString(),
      publishedAt: tugas.publishedAt,
    },
    newValue: data,
  });

  // Baru terbit → notifikasi peserta
  if (data.publishedAt && !sebelumDipublikasikan) {
    const userIds = await userIdPesertaKelas(tugas.kelas.id);
    await kirimNotifikasi({
      userIds,
      tipe: "tugas",
      judul: `Tugas baru: ${updated.judul}`,
      pesan: `${tugas.kelas.mataKuliah.kode} · ${tugas.kelas.mataKuliah.nama}`,
      link: "/mahasiswa/tugas",
    });
  }

  return NextResponse.json({ ok: true, tugas: updated });
}
