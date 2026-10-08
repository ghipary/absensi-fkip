import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/notifikasi/ringkasan — jumlah notifikasi belum dibaca
 * untuk pengguna yang sedang login (dipakai badge bell di topbar).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
  }

  const belumDibaca = await prisma.notifikasi.count({
    where: { userId: user.userId, isRead: false },
  });

  return NextResponse.json({ belumDibaca });
}