import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import type { Role } from "./konstanta";
import { isRole } from "./konstanta";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-ganti-di-produksi"
);

export const SESSION_COOKIE = "siakad_session";
const ACCESS_TTL = "8h";

export type SessionPayload = {
  sub: string;      // identitas (NIM/NIDN/username)
  email: string;
  role: Role;
  nama: string;
  fakultasId: string | null;
  prodiId: string | null;
};

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const p = payload as any;
    if (!p.role || !isRole(p.role)) return null;
    return {
      sub: String(p.sub),
      email: String(p.email ?? ""),
      role: p.role,
      nama: String(p.nama ?? ""),
      fakultasId: p.fakultasId ?? null,
      prodiId: p.prodiId ?? null,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<(SessionPayload & { userId: string }) | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  return { ...payload, userId: payload.sub };
}

export async function requireUser(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (roles && !roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}

export async function setSessionCookie(token: string) {
  const jar = cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export function clearSessionCookie() {
  const jar = cookies();
  jar.delete(SESSION_COOKIE);
}

export async function ambilNama(user: Pick<any, "id" | "role">) {
  // user.id di sini bisa identitas atau userId; fallback aman
  if (user.role === "mahasiswa") {
    const m = await prisma.mahasiswa.findUnique({ where: { nim: user.id }, select: { nama: true } }).catch(() => null);
    if (m?.nama) return m.nama;
  } else if (user.role === "dosen" || user.role === "kaprodi") {
    const d = await prisma.dosen.findUnique({ where: { nidn: user.id }, select: { nama: true } }).catch(() => null);
    if (d?.nama) return d.nama;
  }
  // fallback via User
  const u = await prisma.user.findUnique({ where: { identitas: user.id }, select: { nama: true } }).catch(() => null);
  return u?.nama ?? "Pengguna";
}
