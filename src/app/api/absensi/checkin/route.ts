import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tulisLog } from "@/lib/log";
import { isStatusKehadiran } from "@/lib/konstanta";

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(["mahasiswa"]);
    const body = await req.json();
    const { jadwalId, tanggal, status = "hadir" } = body;
    if (!jadwalId || !tanggal) return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    if (!isStatusKehadiran(status)) return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
    const t = new Date(tanggal);
    t.setHours(0,0,0,0);
    const mhs = await prisma.mahasiswa.findUnique({ where: { nim: u.sub } });
    if (!mhs) return NextResponse.json({ error: "Mahasiswa tidak ditemukan" }, { status: 404 });
    const ab = await prisma.absensi.upsert({
      where: { jadwalId_nim_tanggal: { jadwalId, nim: mhs.nim, tanggal: t } },
      create: { jadwalId, nim: mhs.nim, tanggal: t, status, waktu: new Date(), statusVerifikasi: "menunggu" },
      update: {},
    }).catch(async () => {
      return await prisma.absensi.create({ data: { jadwalId, nim: mhs.nim, tanggal: t, status, waktu: new Date(), statusVerifikasi: "menunggu" } });
    });
    await tulisLog(u.email, `absensi ${status}`);
    return NextResponse.json({ data: ab });
  } catch (e:any) {
    return NextResponse.json({ error: "Gagal absensi" }, { status: 400 });
  }
}
