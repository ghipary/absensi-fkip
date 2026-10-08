import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { broadcastNotifikasi } from "@/lib/sse-bus";

/**
 * GET /api/absensi/manual?kelasId=...&q=...
 * Cari mahasiswa dalam kelas + status absen mereka di pertemuan terpilih.
 * Query tambahan: pertemuanId (opsional)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const kelasId = req.nextUrl.searchParams.get("kelasId");
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const pertemuanId = req.nextUrl.searchParams.get("pertemuanId");

  if (!kelasId) {
    return NextResponse.json({ daftar: [] });
  }

  const anggota = await prisma.kRS.findMany({
    where: {
      kelasId,
      status: "diambil",
      ...(q
        ? {
            mahasiswa: {
              OR: [
                { nama: { contains: q, mode: "insensitive" } },
                { nim: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: { mahasiswa: true },
    orderBy: { mahasiswa: { nama: "asc" } },
    take: 20,
  });

  // Status absen per mahasiswa (bila pertemuan diketahui)
  let statusMap = new Map<string, string>();
  if (pertemuanId) {
    const absen = await prisma.absensi.findMany({
      where: { pertemuanId, mahasiswaId: { in: anggota.map((a) => a.mahasiswaId) } },
    });
    statusMap = new Map(absen.map((a) => [a.mahasiswaId, a.status]));
  }

  return NextResponse.json({
    daftar: anggota.map((a) => ({
      id: a.mahasiswaId,
      nim: a.mahasiswa.nim,
      nama: a.mahasiswa.nama,
      sudahAbsen: statusMap.has(a.mahasiswaId),
      status: statusMap.get(a.mahasiswaId),
    })),
  });
}

/**
 * POST /api/absensi/manual
 * Body: { pertemuanId, mahasiswaId, status, catatan? }
 * Override dosen: hadir/sakit/izin/alpha — selalu tercatat di audit log.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    pertemuanId?: string;
    mahasiswaId?: string;
    status?: string;
    catatan?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const { pertemuanId, mahasiswaId } = body;
  const status = body.status as
    | "hadir"
    | "sakit"
    | "izin"
    | "alpha"
    | undefined;
  if (
    !pertemuanId ||
    !mahasiswaId ||
    !status ||
    !["hadir", "sakit", "izin", "alpha"].includes(status)
  ) {
    return NextResponse.json(
      { error: "Data lengkap wajib diisi: pertemuan, mahasiswa, dan status." },
      { status: 400 }
    );
  }

  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: pertemuanId },
    include: { kelas: { include: { mataKuliah: true, dosen: true } } },
  });
  if (!pertemuan) {
    return NextResponse.json({ error: "Pertemuan tidak ditemukan." }, { status: 404 });
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (
    user.role !== "kaprodi" &&
    (!dosen || dosen.id !== pertemuan.kelas.dosenId)
  ) {
    return NextResponse.json(
      { error: "Anda bukan pengampu kelas ini." },
      { status: 403 }
    );
  }

  const metode = "override" as const;
  const existing = await prisma.absensi.findUnique({
    where: { pertemuanId_mahasiswaId: { pertemuanId, mahasiswaId } },
  });

  let absensi;
  if (existing) {
    absensi = await prisma.absensi.update({
      where: { id: existing.id },
      data: { status, metode, catatan: body.catatan ?? null },
    });
    // Riwayat perubahan (untuk validasi kaprodi bila mencurigakan)
    if (existing.status !== status) {
      await prisma.riwayatPerubahan.create({
        data: {
          tipe: "absensi",
          absensiId: absensi.id,
          kelasId: pertemuan.kelasId,
          mahasiswaId,
          field: "status",
          nilaiLama: existing.status,
          nilaiBaru: status,
          diubahOlehId: user.userId,
          status: "otomatis",
        },
      });
    }
  } else {
    absensi = await prisma.absensi.create({
      data: {
        pertemuanId,
        mahasiswaId,
        status,
        metode,
        catatan: body.catatan ?? null,
      },
    });
  }

  await catatAudit({
    userId: user.userId,
    aksi: existing ? "update" : "create",
    entityType: "absensi",
    entityId: absensi.id,
    oldValue: existing ? { status: existing.status } : undefined,
    newValue: { status, catatan: body.catatan },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  broadcastNotifikasi(
    {
      judul: "Absen manual dicatat",
      pesan: `Pertemuan ke-${pertemuan.nomor} · ${pertemuan.kelas.mataKuliah.nama} · status ${status}.`,
      link: "/dosen/absensi",
    },
    [user.userId]
  );

  return NextResponse.json({ ok: true, absensi: { id: absensi.id, status } });
}
