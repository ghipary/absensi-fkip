import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { cocokkanRole, ROLE_ROUTE } from "@/lib/rbac";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-ganti-di-produksi"
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get("siakad_session")?.value;
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

  if (tujuanRole && !role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("dari", pathname);
    return NextResponse.redirect(url);
  }

  if (tujuanRole && role && !cocokkanRole(pathname, role as never)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${role}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && role) {
    const url = req.nextUrl.clone();
    url.pathname = `/${role}`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = role ? `/${role}` : "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  runtime: 'nodejs', // ✅ Pastikan menggunakan Node.js
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
