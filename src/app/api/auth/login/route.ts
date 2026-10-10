import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie, signSession } from "@/lib/auth";
import { createAcademicProvider } from "@/lib/academic/provider";
import { tulisLog } from "@/lib/log";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan kata sandi wajib diisi." }, { status: 400 });
  }

  const provider = await createAcademicProvider();
  let ident = await provider.verifikasiIdentitas({ email, password });

  let user = null as any;
  if (!ident) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user && user.aktif && (await bcrypt.compare(password, user.passwordHash))) {
      ident = { identitas: user.identitas, nama: user.nama, email: user.email, role: user.role as any, fakultasId: user.fakultasId, prodiId: user.prodiId };
    }
  } else {
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (!ident || !user || !user.aktif) {
    return NextResponse.json({ error: "Kredensial tidak valid atau akun nonaktif." }, { status: 401 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const token = await signSession({
    sub: ident.identitas,
    email: ident.email ?? email,
    role: ident.role,
    nama: ident.nama,
    fakultasId: ident.fakultasId ?? null,
    prodiId: ident.prodiId ?? null,
  });
  await setSessionCookie(token);
  await tulisLog(email, "login");
  return NextResponse.json({ ok: true, tujuan: `/${ident.role}` });
}
