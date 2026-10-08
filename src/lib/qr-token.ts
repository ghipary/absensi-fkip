import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token QR ber-signature (HMAC-SHA256) + expiry.
 * Format: base64url(payload).base64url(signature)
 * Payload: { sid: sesiId, exp: unixDetik }
 *
 * Anti-titip absen:
 * 1. Token terikat ke sesi spesifik & kedaluwarsa.
 * 2. Check-in tetap butuh sesi.status = terbuka & now < expiresAt (validasi DB).
 * 3. Uniqueness (pertemuanId, mahasiswaId) — satu absen per pertemuan.
 */

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-ganti-di-produksi"
);

type Payload = { sid: string; exp: number };

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

export function signQrToken(sesiId: string, expiresAt: Date): string {
  const payload: Payload = { sid: sesiId, exp: Math.floor(expiresAt.getTime() / 1000) };
  const p = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(p).digest("base64url");
  return `${p}.${sig}`;
}

export function verifyQrToken(token: string): Payload | null {
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const expected = createHmac("sha256", secret).update(p).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(p, "base64url").toString()) as Payload;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** URL check-in yang di-encode ke QR (mahasiswa scan → halaman absensi) */
export function urlCheckIn(sesiId: string, token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/mahasiswa/absensi?sesi=${sesiId}&t=${token}`;
}
