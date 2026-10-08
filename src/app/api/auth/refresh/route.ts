import { NextResponse, type NextRequest } from "next/server";
import {
  REFRESH_COOKIE,
  rotateSession,
  signAccess,
  ambilNama,
  setAuthCookies,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/refresh
 * Rotasi refresh token: token lama dicabut, token baru diterbitkan.
 * Dipanggil saat access token expired (interceptor TanStack Query / otomatis oleh browser).
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Sesi berakhir. Silakan masuk kembali." },
      { status: 401 }
    );
  }

  const hasil = await rotateSession(
    token,
    req.headers.get("x-forwarded-for") ?? undefined,
    req.headers.get("user-agent") ?? undefined
  );
  if (!hasil) {
    return NextResponse.json(
      { error: "Sesi berakhir. Silakan masuk kembali." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: hasil.userId } });
  if (!user || user.status !== "aktif") {
    return NextResponse.json({ error: "Akun tidak aktif." }, { status: 403 });
  }

  const nama = await ambilNama(user);
  const access = await signAccess({
    sub: user.id,
    email: user.email,
    role: user.role,
    nama,
  });

  await setAuthCookies({
    access,
    refresh: hasil.token,
    refreshExpires: hasil.expiresAt,
  });

  return NextResponse.json({ ok: true, role: user.role });
}
