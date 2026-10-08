import type { NextRequest } from "next/server";
import { verifyAccess, ACCESS_COOKIE } from "@/lib/auth";
import { addListener } from "@/lib/sse-bus";

/**
 * GET /api/events — SSE stream notifikasi real-time.
 *
 * Auth: access token cookie diverifikasi (wajib login).
 * Keepalive: komentar tiap 25 detik agar proxy tidak memutus koneksi.
 *
 * Format event:
 *   event: notifikasi
 *   data: {"judul":"...","pesan":"...","link":"..."}
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  const payload = token ? await verifyAccess(token) : null;
  if (!payload) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const listener = (data: string) => {
        try {
          controller.enqueue(enc.encode(`event: notifikasi\ndata: ${data}\n\n`));
        } catch {
          remove();
        }
      };
      const remove = addListener(payload.sub, listener);

      // Keepalive tiap 25 detik (mencegah timeout proxy)
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(ping);
          remove();
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        remove();
        try {
          controller.close();
        } catch {
          /* sudah tertutup */
        }
      });

      controller.enqueue(
        enc.encode(`event: siap\ndata: {"pesan":"Terhubung"}\n\n`)
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
