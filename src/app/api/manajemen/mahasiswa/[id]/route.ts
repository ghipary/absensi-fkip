import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { validasiSemesterKe } from "@/lib/semester";
import { jenisSemesterAktif } from "@/lib/semester-server";
import { rincianHapusMahasiswa, totalRincian } from "@/lib/hapus";
import type { Prisma } from "@prisma/client";

/**
 * PATCH /api/manajemen/mahasiswa/[id] — kaprodi memperbaiki data profil mahasiswa
 * (mis. saat mahasiswa melaporkan kekeliruan data). Email akun `User` ikut
 * diperbarui bila dikirim.
 * Body: { nama?, nim?, angkatan?, jenisKelamin?, kelasMhs?, semesterKe?, email?, telepon? }
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
    nama?: string;
    nim?: string;
    angkatan?: number;
    jenisKelamin?: string;
    kelasMhs?: string;
    semesterKe?: number | string | null;
    email?: string;
    telepon?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const mhs = await prisma.mahasiswa.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!mhs) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const tahunIni = new Date().getFullYear();
  const dataMhs: Prisma.MahasiswaUpdateInput = {};
  const dataUser: Prisma.UserUpdateInput = {};
  const lama: Record<string, unknown> = {};
  const baru: Record<string, unknown> = {};

  if (body.nama !== undefined) {
    const nama = String(body.nama).trim();
    if (nama.length < 3 || nama.length > 120) {
      return NextResponse.json({ error: "Nama mahasiswa harus 3–120 karakter." }, { status: 400 });
    }
    dataMhs.nama = nama;
    lama.nama = mhs.nama;
    baru.nama = nama;
  }

  if (body.nim !== undefined) {
    const nim = String(body.nim).trim();
    if (!/^[A-Za-z0-9.\-/]{3,30}$/.test(nim)) {
      return NextResponse.json(
        { error: "NIM wajib diisi (3–30 karakter huruf/angka)." },
        { status: 400 }
      );
    }
    if (nim !== mhs.nim) {
      const dipakai = await prisma.mahasiswa.findUnique({ where: { nim }, select: { id: true } });
      if (dipakai) {
        return NextResponse.json({ error: `NIM ${nim} sudah digunakan.` }, { status: 409 });
      }
    }
    dataMhs.nim = nim;
    lama.nim = mhs.nim;
    baru.nim = nim;
  }

  if (body.angkatan !== undefined) {
    const angkatan = Number(body.angkatan);
    if (
      !Number.isInteger(angkatan) ||
      angkatan < 1990 ||
      angkatan > tahunIni + 1
    ) {
      return NextResponse.json(
        { error: `Angkatan harus tahun yang wajar (1990–${tahunIni + 1}).` },
        { status: 400 }
      );
    }
    dataMhs.angkatan = angkatan;
    lama.angkatan = mhs.angkatan;
    baru.angkatan = angkatan;
  }

  if (body.jenisKelamin !== undefined) {
    const jenisKelamin = String(body.jenisKelamin).trim().toUpperCase();
    if (jenisKelamin !== "L" && jenisKelamin !== "P") {
      return NextResponse.json({ error: "Jenis kelamin harus L atau P." }, { status: 400 });
    }
    dataMhs.jenisKelamin = jenisKelamin;
    lama.jenisKelamin = mhs.jenisKelamin;
    baru.jenisKelamin = jenisKelamin;
  }

  if (body.kelasMhs !== undefined) {
    const kelasMhs = String(body.kelasMhs).trim();
    if (!kelasMhs || kelasMhs.length > 30) {
      return NextResponse.json(
        { error: "Rombongan belajar wajib diisi (maks 30 karakter)." },
        { status: 400 }
      );
    }
    dataMhs.kelasMhs = kelasMhs;
    lama.kelasMhs = mhs.kelasMhs;
    baru.kelasMhs = kelasMhs;
  }

  if (body.semesterKe !== undefined) {
    const parsed = validasiSemesterKe(body.semesterKe, await jenisSemesterAktif());
    if (!parsed.ok) {
      const sama = String(mhs.semesterKe ?? "") === String(body.semesterKe ?? "");
      if (!sama) {
        return NextResponse.json({ error: parsed.pesan }, { status: 400 });
      }
    } else {
      dataMhs.semesterKe = parsed.value;
      lama.semesterKe = mhs.semesterKe;
      baru.semesterKe = parsed.value;
    }
  }

  if (body.telepon !== undefined) {
    const telepon = String(body.telepon).trim() || null;
    if ((telepon?.length ?? 0) > 30) {
      return NextResponse.json({ error: "Telepon maksimal 30 karakter." }, { status: 400 });
    }
    dataMhs.telepon = telepon;
    lama.telepon = mhs.telepon;
    baru.telepon = telepon;
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
    }
    if (email !== mhs.user.email) {
      const dipakai = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (dipakai) {
        return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
      }
    }
    dataUser.email = email;
    lama.email = mhs.user.email;
    baru.email = email;
  }

  if (Object.keys(dataMhs).length === 0 && Object.keys(dataUser).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(dataMhs).length > 0) {
      await tx.mahasiswa.update({ where: { id }, data: dataMhs });
    }
    if (Object.keys(dataUser).length > 0) {
      await tx.user.update({ where: { id: mhs.userId }, data: dataUser });
    }
  });

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: "mahasiswa",
    entityId: id,
    oldValue: lama,
    newValue: baru,
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/manajemen/mahasiswa/[id] — rincian data terkait untuk dialog hapus.
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
  const mhs = await prisma.mahasiswa.findUnique({
    where: { id },
    select: { id: true, nama: true, nim: true },
  });
  if (!mhs) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const rincian = await rincianHapusMahasiswa(id);
  return NextResponse.json({
    label: `${mhs.nama} (${mhs.nim})`,
    rincian,
    total: totalRincian(rincian),
  });
}

/**
 * DELETE /api/manajemen/mahasiswa/[id] — hapus permanen akun mahasiswa (hard
 * delete). Seluruh data akademik terkait (KRS, absensi, tugas, nilai, riwayat)
 * ikut terhapus lewat cascade; jumlahnya ditampilkan di dialog konfirmasi
 * sebelum eksekusi. Hanya kaprodi, dan bukan akun sendiri.
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
  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { id },
    select: { id: true, userId: true, nim: true, nama: true },
  });
  if (!mahasiswa) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  if (mahasiswa.userId === user.userId) {
    return NextResponse.json(
      { error: "Anda tidak dapat menghapus akun Anda sendiri." },
      { status: 400 }
    );
  }

  const rincian = await rincianHapusMahasiswa(id);

  await prisma.$transaction(async (tx) => {
    // Riwayat dengan kolom mahasiswaId longgar (tanpa FK) dibersihkan manual;
    // sisanya ikut terhapus lewat cascade saat User dihapus.
    await tx.riwayatPerubahan.deleteMany({ where: { mahasiswaId: id } });
    await tx.user.delete({ where: { id: mahasiswa.userId } });
  });

  await catatAudit({
    userId: user.userId,
    aksi: "delete",
    entityType: "mahasiswa",
    entityId: id,
    oldValue: { nim: mahasiswa.nim, nama: mahasiswa.nama, dihapus: rincian },
  });

  return NextResponse.json({ ok: true });
}
