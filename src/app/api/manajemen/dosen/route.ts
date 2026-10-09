import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { validasiSemesterKe } from "@/lib/semester";
import { jenisSemesterAktif } from "@/lib/semester-server";

/**
 * POST /api/manajemen/dosen — kaprodi (operator) menambah akun dosen baru.
 * Membuat `User` + `Dosen` sekaligus dalam satu transaksi.
 * Body: { nama, nip, email, password, gelar?, telepon?, bidangStudi?, semesterKe?, role? }
 * `role` dapat "dosen" (default) atau "kaprodi" — kaprodi lain pun dapat dibuat.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    nama?: string;
    nip?: string;
    email?: string;
    password?: string;
    gelar?: string;
    telepon?: string;
    bidangStudi?: string;
    semesterKe?: number | string | null;
    role?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const nama = body.nama?.trim();
  const nip = body.nip?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const gelar = body.gelar?.trim() || null;
  const telepon = body.telepon?.trim() || null;
  const bidangStudi = body.bidangStudi?.trim() || null;
  const role: "dosen" | "kaprodi" = body.role === "kaprodi" ? "kaprodi" : "dosen";

  if (!nama || nama.length < 3 || nama.length > 120) {
    return NextResponse.json(
      { error: "Nama harus 3–120 karakter." },
      { status: 400 }
    );
  }
  if (!nip || !/^[A-Za-z0-9.\-/]{3,30}$/.test(nip)) {
    return NextResponse.json(
      { error: "NIP wajib diisi (3–30 karakter huruf/angka)." },
      { status: 400 }
    );
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
  }

  const semester = validasiSemesterKe(body.semesterKe, await jenisSemesterAktif());
  if (!semester.ok) {
    return NextResponse.json({ error: semester.pesan }, { status: 400 });
  }

  const [emailDipakai, nipDipakai] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.dosen.findUnique({ where: { nip }, select: { id: true } }),
  ]);
  if (emailDipakai) {
    return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
  }
  if (nipDipakai) {
    return NextResponse.json({ error: `NIP ${nip} sudah digunakan.` }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const dosen = await prisma.$transaction(async (tx) => {
    const akun = await tx.user.create({
      data: { email, passwordHash, role, status: "aktif" },
    });
    return tx.dosen.create({
      data: {
        userId: akun.id,
        nip,
        nama,
        gelar,
        telepon,
        bidangStudi,
        semesterKe: semester.value,
        status: "aktif",
      },
      select: { id: true, nip: true, nama: true, gelar: true, bidangStudi: true, semesterKe: true },
    });
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: role === "kaprodi" ? "kaprodi" : "dosen",
    entityId: dosen.id,
    newValue: { nip, nama, email, gelar, bidangStudi, semesterKe: semester.value, role },
  });

  return NextResponse.json({ ok: true, dosen }, { status: 201 });
}
