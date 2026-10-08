import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, revokeSession, clearAuthCookies } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

/** POST /api/auth/logout — cabut refresh token & hapus cookie */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (token) await revokeSession(token);
  clearAuthCookies();

  if (user) {
    await catatAudit({
      userId: user.userId,
      aksi: "logout",
      entityType: "auth",
      entityId: user.userId,
      ipAddress: req.headers.get("x-forwarded-for"),
    });
  }

  return NextResponse.json({ ok: true });
}
