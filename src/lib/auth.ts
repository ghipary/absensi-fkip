import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import type { Role, User } from "@prisma/client";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-ganti-di-produksi"
);

export const ACCESS_COOKIE = "absensi_access";
export const REFRESH_COOKIE = "absensi_refresh";

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL ?? "15m";
const REFRESH_TTL_DAYS = 7;

export type AksesToken = {
  sub: string;
  email: string;
  role: Role;
  nama: string;
};

/** Buat access token (15 menit) */
export async function signAccess(payload: AksesToken) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

/** Verifikasi access token; null bila tidak valid */
export async function verifyAccess(token: string): Promise<AksesToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AksesToken;
  } catch {
    return null;
  }
}

/** SHA-256 untuk menyimpan refresh token (bukan token mentah) */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Buat refresh token: opaque random string, disimpan HASH di tabel sessions.
 * Rotasi: token lama dicabut saat dipakai.
 */
export async function createSession(userId: string, ip?: string, ua?: string) {
  const token = randomBytes(48).toString("base64url");
  const expiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: ip ?? null,
      userAgent: ua ?? null,
    },
  });
  return { token, expiresAt };
}

/** Tukar refresh token baru ⇄ baru (rotasi). Null bila kadaluarsa/dicabut. */
export async function rotateSession(token: string, ip?: string, ua?: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  // Cabut token lama, buat baru
  const newToken = randomBytes(48).toString("base64url");
  const expiresAt = new Date(
    Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  );
  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        tokenHash: hashToken(newToken),
        expiresAt,
        ipAddress: ip ?? null,
        userAgent: ua ?? null,
      },
    }),
  ]);
  return { token: newToken, expiresAt, userId: session.userId };
}

export async function revokeSession(token: string) {
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Baca access token dari cookie & verifikasi — untuk Server Component / API */
export async function getCurrentUser(): Promise<
  (AksesToken & { userId: string }) | null
> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifyAccess(token);
  if (!payload) return null;
  return { ...payload, userId: payload.sub };
}

/** Guard server-side: lempar bila belum login / role salah */
export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (roles && !roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export async function setAuthCookies(tokens: {
  access: string;
  refresh: string;
  refreshExpires: Date;
}) {
  const jar = cookies();
  jar.set(ACCESS_COOKIE, tokens.access, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });
  jar.set(REFRESH_COOKIE, tokens.refresh, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth",
    expires: tokens.refreshExpires,
  });
}

export function clearAuthCookies() {
  const jar = cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/** Ambil nama tampilan dari DB berdasarkan role (untuk token payload) */
export async function ambilNama(user: Pick<User, "id" | "role">) {
  if (user.role === "mahasiswa") {
    const m = await prisma.mahasiswa.findUnique({
      where: { userId: user.id },
      select: { nama: true },
    });
    return m?.nama ?? "Mahasiswa";
  }
  const d = await prisma.dosen.findUnique({
    where: { userId: user.id },
    select: { nama: true },
  });
  return d?.nama ?? (user.role === "kaprodi" ? "Kaprodi" : "Dosen");
}
