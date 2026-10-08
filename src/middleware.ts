import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { cocokkanRole, ROLE_ROUTE } from "@/lib/rbac";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-ganti-di-produksi"
);

/**
 * Middleware RBAC:
 * 1. Belum login + akses route ber-role → redirect /login
 * 2. Role salah untuk prefix route → redirect ke dashboard role sendiri
 * 3. Login saat sudah punya token valid → redirect ke dashboard role
 *
 * Catatan: route API TIDAK di-pass-through sini — tiap handler punya guard sendiri.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Lewati asset & API (API dijaga per-handler)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("absensi_access")?.value;
  let role: string | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      role = String(payload.role);
    } catch {
      role = null;
    }
  }

  const tujuanRole = Object.entries(ROLE_ROUTE).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/")
  )?.[1];

  // Akses route ber-role tanpa login / token expired
  if (tujuanRole && !role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("dari", pathname);
    return NextResponse.redirect(url);
  }

  // Role salah → ke dashboard role sendiri
  if (tujuanRole && role && !cocokkanRole(pathname, role as never)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${role}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Sudah login tapi buka /login → redirect ke dashboard
  if (pathname === "/login" && role) {
    const url = req.nextUrl.clone();
    url.pathname = `/${role}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Root → dashboard sesuai role
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = role ? `/${role}` : "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
