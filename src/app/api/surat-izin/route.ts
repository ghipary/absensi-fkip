import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi } from "@/lib/notifikasi";

export const runtime = "nodejs";

const SEMBUNYI = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
} as const;

const BATAS_BYTE = 5 * 1024 * 1024; // 5 MB

/**
 * POST /api/surat-izin — mahasiswa mengunggah surat izin/sakit untuk sebuah absensi.
 * Body (multipart/form-data): absensiId, berkas (File), keterangan?
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
    select: { id: true, nama: true, nim: true },
  });
  if (!mahasiswa) {
    return NextResponse.json({ error: "Profil mahasiswa tidak ditemukan." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const absensiId = String(form.get("absensiId") ?? "").trim();
  const keterangan = String(form.get("keterangan") ?? "").trim().slice(0, 500) || null;
  const berkas = form.get("berkas");

  if (!absensiId) {
    return NextResponse.json({ error: "Absensi tidak diketahui." }, { status: 400 });
  }
  if (!(berkas instanceof File) || berkas.size === 0) {
    return NextResponse.json({ error: "Berkas surat wajib diunggah." }, { status: 400 });
  }
  if (berkas.size > BATAS_BYTE) {
    return NextResponse.json({ error: "Ukuran berkas maksimal 5 MB." }, { status: 413 });
  }
  const ekstensi = SEMBUNYI[berkas.type as keyof typeof SEMBUNYI];
  if (!ekstensi) {
    return NextResponse.json(
      { error: "Format berkas harus PDF, JPG, atau PNG." },
      { status: 400 }
    );
  }

  const absensi = await prisma.absensi.findUnique({
    where: { id: absensiId },
    include: {
      surat: true,
      pertemuan: {
        include: {
          kelas: {
            include: {
              mataKuliah: { select: { kode: true, nama: true } },
              dosen: { select: { userId: true } },
            },
          },
        },
      },
    },
  });
  if (!absensi || absensi.mahasiswaId !== mahasiswa.id) {
    return NextResponse.json({ error: "Catatan absensi tidak ditemukan." }, { status: 404 });
  }
  if (absensi.status === "hadir") {
    return NextResponse.json(
      { error: "Absensi berstatus hadir tidak memerlukan surat izin." },
      { status: 400 }
    );
  }
  if (absensi.surat && absensi.surat.status !== "ditolak") {
    return NextResponse.json(
      { error: "Surat untuk absensi ini sudah diajukan." },
      { status: 409 }
    );
  }

  // Simpan berkas ke public/uploads/surat-izin
  const direktori = path.join(process.cwd(), "public", "uploads", "surat-izin");
  await mkdir(direktori, { recursive: true });
  const namaBerkas = `${randomUUID()}.${ekstensi}`;
  const buffer = Buffer.from(await berkas.arrayBuffer());
  await writeFile(path.join(direktori, namaBerkas), buffer);
  const filePath = `/uploads/surat-izin/${namaBerkas}`;

  const surat = absensi.surat
    ? await prisma.suratIzin.update({
        where: { absensiId },
        data: { filePath, keterangan, status: "menunggu", reviewedById: null },
      })
    : await prisma.suratIzin.create({
        data: { absensiId, filePath, keterangan, status: "menunggu" },
      });

  const kelas = absensi.pertemuan.kelas;
  await kirimNotifikasi({
    userIds: [kelas.dosen.userId],
    tipe: "absensi",
    judul: "Pengajuan surat izin",
    pesan: `${mahasiswa.nama} (${mahasiswa.nim}) mengajukan surat izin untuk ${kelas.mataKuliah.nama} pertemuan ke-${absensi.pertemuan.nomor}.`,
    link: "/dosen/absensi",
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "surat_izin",
    entityId: surat.id,
    newValue: { absensiId, keterangan, filePath },
  });

  return NextResponse.json(
    { ok: true, surat: { id: surat.id, status: surat.status } },
    { status: 201 }
  );
}
