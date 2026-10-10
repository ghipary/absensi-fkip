import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tulisLog } from "@/lib/log";
import { isStatusVerifikasi } from "@/lib/konstanta";

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(["dosen","kaprodi"]);
    const body = await req.json();
    const { absensiId, statusVerifikasi, diverifikasiOleh } = body;
    if (!absensiId || !isStatusVerifikasi(statusVerifikasi)) return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    const ab = await prisma.absensi.update({ where: { id: absensiId }, data: { statusVerifikasi, diverifikasiOleh: diverifikasiOleh || u.sub } });
    await tulisLog(u.email, `verifikasi absensi ${statusVerifikasi}`);
    return NextResponse.json({ data: ab });
  } catch { return NextResponse.json({ error: "Gagal verifikasi" }, { status: 400 }); }
}
