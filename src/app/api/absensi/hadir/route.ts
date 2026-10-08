import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/absensi/hadir?sesiId=... — daftar check-in sesi (untuk polling dosen) */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const sesiId = req.nextUrl.searchParams.get("sesiId");
  if (!sesiId) {
    return NextResponse.json({ daftar: [] });
  }

  const sesi = await prisma.sesiAbsensi.findUnique({ where: { id: sesiId } });
  if (!sesi) {
    return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  }

  // Hanya pengampu kelas tsb (kaprodi boleh)
  if (user.role !== "kaprodi") {
    const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
    if (!dosen || dosen.id !== sesi.dosenId) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }
  }

  const absensi = await prisma.absensi.findMany({
    where: { sesiId },
    include: { mahasiswa: true },
    orderBy: { checkInAt: "asc" },
  });

  return NextResponse.json({
    daftar: absensi.map((a) => ({
      id: a.id,
      nim: a.mahasiswa.nim,
      nama: a.mahasiswa.nama,
      status: a.status,
      metode: a.metode,
      checkInAt: a.checkInAt.toISOString(),
    })),
  });
}
