import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/**
 * PATCH /api/manajemen/semester/[id] — kaprodi menetapkan semester aktif.
 * Semester lain otomatis dinonaktifkan dalam satu transaksi.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  const semester = await prisma.semester.findUnique({
    where: { id },
    include: { tahun: { select: { nama: true } } },
  });
  if (!semester) {
    return NextResponse.json({ error: "Semester tidak ditemukan." }, { status: 404 });
  }
  if (semester.isAktif) {
    return NextResponse.json({ ok: true }); // sudah aktif, idempoten
  }

  await prisma.$transaction([
    prisma.semester.updateMany({ where: { isAktif: true }, data: { isAktif: false } }),
    prisma.semester.update({ where: { id }, data: { isAktif: true } }),
  ]);

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: "semester",
    entityId: id,
    oldValue: { semester: `${semester.nama} ${semester.tahun.nama}`, isAktif: false },
    newValue: { semester: `${semester.nama} ${semester.tahun.nama}`, isAktif: true },
  });

  return NextResponse.json({ ok: true });
}