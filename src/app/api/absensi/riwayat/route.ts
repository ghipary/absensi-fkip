import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const u = await requireUser(["mahasiswa","dosen","kaprodi","admin"]);
    let where: any = {};
    if (u.role === "mahasiswa") {
      const mhs = await prisma.mahasiswa.findUnique({ where: { nim: u.sub } });
      if (mhs) where.nim = mhs.nim;
    }
    const data = await prisma.absensi.findMany({ where, orderBy: { waktu: "desc" }, include: { jadwal: { include: { mataKuliah: true } } } });
    return NextResponse.json({ data });
  } catch { return NextResponse.json({ error: "Gagal" }, { status: 401 }); }
}
