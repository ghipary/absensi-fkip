import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { validasiSemesterKe } from "@/lib/semester";
import { jenisSemesterAktif } from "@/lib/semester-server";
import type { KategoriMK } from "@prisma/client";

/**
 * POST /api/manajemen/mk — kaprodi menambah mata kuliah baru.
 * Body: { kode, nama, sks, kategori?, semesterKe? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    kode?: string;
    nama?: string;
    sks?: number;
    kategori?: KategoriMK;
    semesterKe?: number | string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const kode = body.kode?.trim().toUpperCase();
  const nama = body.nama?.trim();
  const sks = body.sks;
  const kategori = body.kategori ?? "wajib";

  if (!kode || !/^[A-Z0-9]{3,12}$/.test(kode)) {
    return NextResponse.json(
      { error: "Kode mata kuliah wajib diisi (3–12 karakter huruf/angka)." },
      { status: 400 }
    );
  }
  if (!nama || nama.length < 3 || nama.length > 120) {
    return NextResponse.json(
      { error: "Nama mata kuliah harus 3–120 karakter." },
      { status: 400 }
    );
  }
  if (typeof sks !== "number" || !Number.isInteger(sks) || sks < 1 || sks > 6) {
    return NextResponse.json({ error: "SKS harus angka 1–6." }, { status: 400 });
  }
  if (kategori !== "wajib" && kategori !== "pilihan") {
    return NextResponse.json({ error: "Kategori harus wajib atau pilihan." }, { status: 400 });
  }

  const jenis = await jenisSemesterAktif();
  const semester = validasiSemesterKe(body.semesterKe, jenis);
  if (!semester.ok) {
    return NextResponse.json({ error: semester.pesan }, { status: 400 });
  }

  const sudahAda = await prisma.mataKuliah.findUnique({ where: { kode } });
  if (sudahAda) {
    return NextResponse.json(
      { error: `Kode ${kode} sudah digunakan oleh mata kuliah lain.` },
      { status: 409 }
    );
  }

  const mk = await prisma.mataKuliah.create({
    data: { kode, nama, sks, kategori, semesterKe: semester.value },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "mata_kuliah",
    entityId: mk.id,
    newValue: { kode, nama, sks, kategori, semesterKe: semester.value },
  });

  return NextResponse.json({ ok: true, mataKuliah: mk }, { status: 201 });
}