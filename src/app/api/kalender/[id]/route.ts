import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/** DELETE /api/kalender/[id] — kaprodi menghapus agenda kalender akademik. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  const agenda = await prisma.kalenderAkademik.findUnique({ where: { id } });
  if (!agenda) {
    return NextResponse.json({ error: "Agenda tidak ditemukan." }, { status: 404 });
  }

  await prisma.kalenderAkademik.delete({ where: { id } });

  await catatAudit({
    userId: user.userId,
    aksi: "delete",
    entityType: "kalender_akademik",
    entityId: id,
    oldValue: {
      tanggal: agenda.tanggal.toISOString(),
      tipe: agenda.tipe,
      judul: agenda.judul,
    },
  });

  return NextResponse.json({ ok: true });
}
