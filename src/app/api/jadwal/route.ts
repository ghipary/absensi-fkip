import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser(["mahasiswa","dosen","kaprodi","admin"]);
    const jadwal = await prisma.jadwal.findMany({
      include: { mataKuliah: true, dosen: true },
      orderBy: [{ hari: "asc" }, { jamMulai: "asc" }],
    });
    return NextResponse.json({ data: jadwal });
  } catch (e:any) {
    const code = e?.message === "UNAUTHORIZED" ? 401 : e?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: "Gagal memuat jadwal" }, { status: code });
  }
}
