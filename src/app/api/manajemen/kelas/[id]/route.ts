import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { validasiJadwal, type DataJadwal, type JadwalInput } from "@/lib/kelas";
import { rincianHapusKelas, totalRincian } from "@/lib/hapus";
import type { Prisma } from "@prisma/client";

/**
 * PATCH /api/manajemen/kelas/[id] — kaprodi memperbarui kelas: mengganti dosen
 * pengampu (assign ulang), kode kelas, kapasitas, atau jadwal.
 * Body: { dosenId?, kodeKelas?, kapasitas?, jadwal?: JadwalInput | null }
 * `jadwal: null` menghapus jadwal kelas.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  let body: {
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

  const kelas = await prisma.kelas.findUnique({
    where: { id },
    include: { mataKuliah: { select: { kode: true, nama: true } } },
  });
  if (!kelas || kelas.deletedAt !== null) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const data: Prisma.KelasUpdateInput = {};
  const lama: Record<string, unknown> = {};
  const baru: Record<string, unknown> = {};

  if (body.dosenId !== undefined) {
    const dosenId = String(body.dosenId).trim();
    const dosen = await prisma.dosen.findUnique({ where: { id: dosenId }, select: { id: true } });
    if (!dosen) {
      return NextResponse.json({ error: "Dosen pengampu tidak ditemukan." }, { status: 404 });
    }
    if (dosenId !== kelas.dosenId) {
      data.dosen = { connect: { id: dosenId } };
      lama.dosenId = kelas.dosenId;
      baru.dosenId = dosenId;
    }
  }

  if (body.kodeKelas !== undefined) {
    const kodeKelas = String(body.kodeKelas).trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,10}$/.test(kodeKelas)) {
      return NextResponse.json(
        { error: "Kode kelas 1–10 karakter (huruf/angka/tanda hubung)." },
        { status: 400 }
      );
    }
    if (kodeKelas !== kelas.kodeKelas) {
      const dipakai = await prisma.kelas.findFirst({
        where: {
          mkId: kelas.mkId,
          semesterId: kelas.semesterId,
          kodeKelas,
          NOT: { id },
        },
        select: { id: true },
      });
      if (dipakai) {
        return NextResponse.json(
          { error: `Kode kelas ${kodeKelas} sudah dipakai pada mata kuliah & semester yang sama.` },
          { status: 409 }
        );
      }
      data.kodeKelas = kodeKelas;
      lama.kodeKelas = kelas.kodeKelas;
      baru.kodeKelas = kodeKelas;
    }
  }

  if (body.kapasitas !== undefined) {
    const kapasitas = Number(body.kapasitas);
    if (!Number.isInteger(kapasitas) || kapasitas < 1 || kapasitas > 200) {
      return NextResponse.json({ error: "Kapasitas harus angka 1–200." }, { status: 400 });
    }
    data.kapasitas = kapasitas;
    lama.kapasitas = kelas.kapasitas;
    baru.kapasitas = kapasitas;
  }

  const gantiJadwal = body.jadwal !== undefined;
  let jadwalBaru: DataJadwal | null = null;
  if (gantiJadwal) {
    const cek = validasiJadwal(body.jadwal);
    if (cek.error) {
      return NextResponse.json({ error: cek.error }, { status: 400 });
    }
    jadwalBaru = cek.data ?? null;
  }

  if (Object.keys(data).length === 0 && !gantiJadwal) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.kelas.update({ where: { id }, data });
    }
    if (gantiJadwal) {
      await tx.jadwal.deleteMany({ where: { kelasId: id } });
      if (jadwalBaru) {
        await tx.jadwal.create({ data: { kelasId: id, ...jadwalBaru } });
      }
    }
  });

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: "kelas",
    entityId: id,
    oldValue: lama,
    newValue: { ...baru, ...(gantiJadwal ? { jadwal: jadwalBaru } : {}) },
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/manajemen/kelas/[id] — rincian data terkait untuk dialog hapus.
 * Hanya kaprodi yang boleh melihat & menghapus.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  const kelas = await prisma.kelas.findUnique({
    where: { id },
    select: {
      id: true,
      kodeKelas: true,
      deletedAt: true,
      mataKuliah: { select: { nama: true } },
    },
  });
  if (!kelas || kelas.deletedAt !== null) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const rincian = await rincianHapusKelas(id);
  return NextResponse.json({
    label: `${kelas.mataKuliah.nama} — ${kelas.kodeKelas}`,
    rincian,
    total: totalRincian(rincian),
  });
}

/**
 * DELETE /api/manajemen/kelas/[id] — hapus permanen kelas (hard delete).
 * Seluruh data akademik di dalamnya (KRS, pertemuan, absensi, tugas, nilai,
 * pengumuman) ikut terhapus lewat cascade. Jumlahnya ditampilkan di dialog
 * konfirmasi sebelum eksekusi.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  const kelas = await prisma.kelas.findUnique({
    where: { id },
    select: { id: true, kodeKelas: true, deletedAt: true, mataKuliah: { select: { kode: true } } },
  });
  if (!kelas || kelas.deletedAt !== null) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const rincian = await rincianHapusKelas(id);

  await prisma.kelas.delete({ where: { id } });

  await catatAudit({
    userId: user.userId,
    aksi: "delete",
    entityType: "kelas",
    entityId: id,
    oldValue: {
      kode: kelas.mataKuliah.kode,
      kodeKelas: kelas.kodeKelas,
      dihapus: rincian,
    },
  });

  return NextResponse.json({ ok: true });
}
