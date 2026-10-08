import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/**
 * POST /api/manajemen/mahasiswa — kaprodi (operator) menambah akun mahasiswa baru.
 * Membuat `User` (role mahasiswa) + `Mahasiswa` sekaligus dalam satu transaksi.
 * Body: { nama, nim, angkatan, jenisKelamin, kelasMhs, email, password, telepon? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    nama?: string;
    nim?: string;
    angkatan?: number;
    jenisKelamin?: string;
    kelasMhs?: string;
    email?: string;
    password?: string;
    telepon?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const nama = body.nama?.trim();
  const nim = body.nim?.trim();
  const angkatan = body.angkatan;
  const jenisKelamin = body.jenisKelamin?.trim().toUpperCase();
  const kelasMhs = body.kelasMhs?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const telepon = body.telepon?.trim() || null;

  const tahunIni = new Date().getFullYear();
  if (!nama || nama.length < 3 || nama.length > 120) {
    return NextResponse.json({ error: "Nama mahasiswa harus 3–120 karakter." }, { status: 400 });
  }
  if (!nim || !/^[A-Za-z0-9.\-/]{3,30}$/.test(nim)) {
    return NextResponse.json(
      { error: "NIM wajib diisi (3–30 karakter huruf/angka)." },
      { status: 400 }
    );
  }
  if (
    typeof angkatan !== "number" ||
    !Number.isInteger(angkatan) ||
    angkatan < 1990 ||
    angkatan > tahunIni + 1
  ) {
    return NextResponse.json(
      { error: `Angkatan harus tahun yang wajar (1990–${tahunIni + 1}).` },
      { status: 400 }
    );
  }
  if (jenisKelamin !== "L" && jenisKelamin !== "P") {
    return NextResponse.json({ error: "Jenis kelamin harus L atau P." }, { status: 400 });
  }
  if (!kelasMhs || kelasMhs.length > 30) {
    return NextResponse.json(
      { error: "Rombongan belajar wajib diisi (mis. 2023-A)." },
      { status: 400 }
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
  }

  const [emailDipakai, nimDipakai] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.mahasiswa.findUnique({ where: { nim }, select: { id: true } }),
  ]);
  if (emailDipakai) {
    return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
  }
  if (nimDipakai) {
    return NextResponse.json({ error: `NIM ${nim} sudah digunakan.` }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const mahasiswa = await prisma.$transaction(async (tx) => {
    const akun = await tx.user.create({
      data: { email, passwordHash, role: "mahasiswa", status: "aktif" },
    });
    return tx.mahasiswa.create({
      data: {
        userId: akun.id,
        nim,
        nama,
        angkatan,
        jenisKelamin,
        kelasMhs,
        telepon,
        status: "aktif",
      },
      select: { id: true, nim: true, nama: true, angkatan: true, kelasMhs: true },
    });
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "mahasiswa",
    entityId: mahasiswa.id,
    newValue: { nim, nama, email, angkatan, jenisKelamin, kelasMhs },
  });

  return NextResponse.json({ ok: true, mahasiswa }, { status: 201 });
}
