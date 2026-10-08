import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  signAccess,
  createSession,
  setAuthCookies,
  ambilNama,
} from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Sukses: set cookie access (15 mnt) + refresh (7 hari, path /api/auth)
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Permintaan tidak valid." },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email dan kata sandi wajib diisi." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Pesan generik — jangan bocorkan email terdaftar atau tidak
  const pesanSalah = "Email atau kata sandi salah.";

  if (!user || user.status !== "aktif") {
    return NextResponse.json({ error: pesanSalah }, { status: 401 });
  }

  const cocok = await bcrypt.compare(password, user.passwordHash);
  if (!cocok) {
    return NextResponse.json({ error: pesanSalah }, { status: 401 });
  }

  const nama = await ambilNama(user);
  const access = await signAccess({
    sub: user.id,
    email: user.email,
    role: user.role,
    nama,
  });
  const refresh = await createSession(
    user.id,
    req.headers.get("x-forwarded-for") ?? undefined,
    req.headers.get("user-agent") ?? undefined
  );

  await setAuthCookies({
    access,
    refresh: refresh.token,
    refreshExpires: refresh.expiresAt,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await catatAudit({
    userId: user.id,
    aksi: "login",
    entityType: "auth",
    entityId: user.id,
    ipAddress: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({
    ok: true,
    role: user.role,
    tujuan: `/${user.role}`,
  });
}
