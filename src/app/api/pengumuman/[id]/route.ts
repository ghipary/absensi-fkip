import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/**
 * DELETE /api/pengumuman/[id]
 * Kaprodi dapat menghapus pengumuman apa pun.
 * Dosen hanya dapat menghapus pengumuman yang ia buat sendiri.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  const pengumuman = await prisma.pengumuman.findUnique({ where: { id } });
  if (!pengumuman) {
    return NextResponse.json({ error: "Pengumuman tidak ditemukan." }, { status: 404 });
  }
  if (user.role === "dosen" && pengumuman.createdById !== user.userId) {
    return NextResponse.json(
      { error: "Anda hanya dapat menghapus pengumuman sendiri." },
      { status: 403 }
    );
  }

  await prisma.pengumuman.delete({ where: { id } });

  await catatAudit({
    userId: user.userId,
    aksi: "delete",
    entityType: "pengumuman",
    entityId: id,
    oldValue: { judul: pengumuman.judul },
  });

  return NextResponse.json({ ok: true });
}