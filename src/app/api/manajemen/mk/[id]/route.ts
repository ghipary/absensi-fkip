import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { validasiSemesterKe } from "@/lib/semester";
import { jenisSemesterAktif } from "@/lib/semester-server";
import type { KategoriMK, Prisma } from "@prisma/client";

/**
 * PATCH /api/manajemen/mk/[id] — kaprodi memperbarui data atau status mata kuliah.
 * Body: { aktif?, kode?, nama?, sks?, kategori? }
 * `aktif:false` menonaktifkan lewat soft-delete (deletedAt); `aktif:true` memulihkan.
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
    aktif?: boolean;
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

  const mk = await prisma.mataKuliah.findUnique({ where: { id } });
  if (!mk) {
    return NextResponse.json({ error: "Mata kuliah tidak ditemukan." }, { status: 404 });
  }

  const data: Prisma.MataKuliahUpdateInput = {};
  const baru: Record<string, unknown> = {};

  if (body.kode !== undefined) {
    const kode = String(body.kode).trim().toUpperCase();
    if (!/^[A-Z0-9]{3,12}$/.test(kode)) {
      return NextResponse.json(
        { error: "Kode mata kuliah wajib 3–12 karakter huruf/angka." },
        { status: 400 }
      );
    }
    if (kode !== mk.kode) {
      const dipakai = await prisma.mataKuliah.findUnique({
        where: { kode },
        select: { id: true },
      });
      if (dipakai) {
        return NextResponse.json(
          { error: `Kode ${kode} sudah digunakan oleh mata kuliah lain.` },
          { status: 409 }
        );
      }
    }
    data.kode = kode;
    baru.kode = kode;
  }

  if (body.nama !== undefined) {
    const nama = String(body.nama).trim();
    if (nama.length < 3 || nama.length > 120) {
      return NextResponse.json(
        { error: "Nama mata kuliah harus 3–120 karakter." },
        { status: 400 }
      );
    }
    data.nama = nama;
    baru.nama = nama;
  }

  if (body.sks !== undefined) {
    const sks = Number(body.sks);
    if (!Number.isInteger(sks) || sks < 1 || sks > 6) {
      return NextResponse.json({ error: "SKS harus angka 1–6." }, { status: 400 });
    }
    data.sks = sks;
    baru.sks = sks;
  }

  if (body.kategori !== undefined) {
    if (body.kategori !== "wajib" && body.kategori !== "pilihan") {
      return NextResponse.json({ error: "Kategori harus wajib atau pilihan." }, { status: 400 });
    }
    data.kategori = body.kategori;
    baru.kategori = body.kategori;
  }

  if (body.semesterKe !== undefined) {
    const parsed = validasiSemesterKe(body.semesterKe, await jenisSemesterAktif());
    if (!parsed.ok) {
      // Nilai tersimpan dibiarkan bila tidak berubah (mis. edit nama saja).
      const sama = String(mk.semesterKe ?? "") === String(body.semesterKe ?? "");
      if (!sama) {
        return NextResponse.json({ error: parsed.pesan }, { status: 400 });
      }
    } else {
      data.semesterKe = parsed.value;
      baru.semesterKe = parsed.value;
    }
  }

  if (body.aktif !== undefined) {
    data.deletedAt = body.aktif ? null : new Date();
    baru.aktif = Boolean(body.aktif);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
  }

  await prisma.mataKuliah.update({ where: { id }, data });

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: "mata_kuliah",
    entityId: id,
    oldValue: { kode: mk.kode, nama: mk.nama, sks: mk.sks, kategori: mk.kategori, semesterKe: mk.semesterKe, deletedAt: mk.deletedAt },
    newValue: baru,
  });

  return NextResponse.json({ ok: true });
}
