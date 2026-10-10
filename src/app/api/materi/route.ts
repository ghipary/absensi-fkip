import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tulisLog } from "@/lib/log";

export async function GET() {
  try {
    await requireUser(["mahasiswa","dosen","kaprodi","admin"]);
    const data = await prisma.materi.findMany({ orderBy: { tanggal: "desc" }, include: { jadwal: { include: { mataKuliah: true, dosen: true } } } });
    return NextResponse.json({ data });
  } catch (e:any) {
    return NextResponse.json({ error: "Gagal" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(["dosen","kaprodi"]);
    const body = await req.json();
    const m = await prisma.materi.create({ data: { jadwalId: body.jadwalId, judul: body.judul, deskripsi: body.deskripsi || null, fileUrl: body.fileUrl || null, dibuatOleh: u.sub } });
    await tulisLog(u.email, `upload materi ${m.judul}`);
    return NextResponse.json({ data: m });
  } catch (e:any) {
    return NextResponse.json({ error: "Gagal" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const u = await requireUser(["dosen","kaprodi"]);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });
    await prisma.materi.delete({ where: { id } });
    await tulisLog(u.email, `hapus materi ${id}`);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Gagal" }, { status: 400 }); }
}
