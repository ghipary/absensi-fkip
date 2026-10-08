import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { muatLaporanSemester, namaBerkasLaporan } from "@/lib/laporan";
import { buatExcelLaporan } from "@/lib/ekspor/excel";
import { buatPdfLaporan } from "@/lib/ekspor/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPE_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * GET /api/laporan/export?format=xlsx|pdf
 * Menghasilkan berkas laporan akademik semester aktif (kaprodi saja).
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (user.role !== "kaprodi") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "xlsx").toLowerCase();

  try {
    const data = await muatLaporanSemester();

    if (format === "pdf") {
      const buf = await buatPdfLaporan(data);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${namaBerkasLaporan("pdf", data)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (format === "xlsx" || format === "excel") {
      const buf = await buatExcelLaporan(data);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": TIPE_XLSX,
          "Content-Disposition": `attachment; filename="${namaBerkasLaporan("xlsx", data)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({ error: "FORMAT_TIDAK_DIDUKUNG" }, { status: 400 });
  } catch (err) {
    console.error("[laporan/export]", err);
    return NextResponse.json({ error: "GAGAL_MEMBUAT_BERKAS" }, { status: 500 });
  }
}
