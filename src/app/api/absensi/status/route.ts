import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { urlCheckIn } from "@/lib/qr-token";

/** GET /api/absensi/status?kelasId=... — sesi terbuka terbaru untuk kelas */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const kelasId = req.nextUrl.searchParams.get("kelasId");
  if (!kelasId) {
    return NextResponse.json({ sesi: null });
  }

  const sesi = await prisma.sesiAbsensi.findFirst({
    where: {
      kelasId,
      status: "terbuka",
      expiresAt: { gt: new Date() },
    },
    orderBy: { openedAt: "desc" },
  });

  if (!sesi) return NextResponse.json({ sesi: null });

  return NextResponse.json({
    sesi: {
      id: sesi.id,
      kodeUnik: sesi.kodeUnik,
      qrUrl: urlCheckIn(sesi.id, sesi.token),
      expiresAt: sesi.expiresAt.toISOString(),
      metode: sesi.metode,
      lokasiWajib: sesi.lokasiWajib,
    },
  });
}
