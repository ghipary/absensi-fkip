import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { verifyQrToken } from "@/lib/qr-token";
import { jarakMeter } from "@/lib/utils";
import { catatAudit } from "@/lib/audit";
import { broadcastNotifikasi } from "@/lib/sse-bus";

/**
 * POST /api/absensi/checkin — mahasiswa melakukan check-in
 *
 * Body (salah satu):
 *   { token }              — hasil scan QR (berisi sesiId + signature + exp)
 *   { kodeUnik, sesiId? }  — kode unik 6 digit; bila sesiId kosong, cari sesi terbuka terbaru
 *
 * Validasi keamanan:
 *   1. Signature QR cocok & belum expired (verifyQrToken)
 *   2. Sesi di DB masih "terbuka" & now < expiresAt
 *   3. Uniqueness (pertemuanId, mahasiswaId) — satu check-in per pertemuan
 *   4. Lokasi bila lokasiWajib (haversine ≤ radiusMeter)
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "mahasiswa") {
    return NextResponse.json(
      { error: "Hanya mahasiswa yang dapat melakukan absen." },
      { status: 403 }
    );
  }

  let body: {
    token?: string;
    kodeUnik?: string;
    sesiId?: string;
    latitude?: number;
    longitude?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const mahasiswa = await prisma.mahasiswa.findUnique({
    where: { userId: user.userId },
  });
  if (!mahasiswa) {
    return NextResponse.json(
      { error: "Profil mahasiswa tidak ditemukan." },
      { status: 404 }
    );
  }
  if (mahasiswa.status !== "aktif") {
    return NextResponse.json(
      { error: "Status keaktifan Anda tidak memungkinkan absen." },
      { status: 403 }
    );
  }

  // ── 1. Tentukan sesi dari token QR atau kode unik ──────────────
  let sesiId: string | null = null;

  if (body.token) {
    const payload = verifyQrToken(body.token);
    if (!payload) {
      return NextResponse.json(
        { error: "QR tidak valid atau sudah kedaluwarsa. Mintalah kode baru dari dosen." },
        { status: 400 }
      );
    }
    // Sesi selalu diturunkan dari payload bertanda tangan — bukan dari body
    sesiId = payload.sid;
  } else if (body.kodeUnik) {
    const kode = body.kodeUnik.trim();
    if (!/^\d{6}$/.test(kode)) {
      return NextResponse.json(
        { error: "Kode unik harus 6 digit angka." },
        { status: 400 }
      );
    }
    if (body.sesiId) {
      const s = await prisma.sesiAbsensi.findUnique({ where: { id: body.sesiId } });
      if (!s || s.kodeUnik !== kode) {
        return NextResponse.json(
          { error: "Kode unik tidak cocok dengan sesi absensi." },
          { status: 400 }
        );
      }
      sesiId = s.id;
    } else {
      // Cari sesi terbuka dengan kode unik ini
      const s = await prisma.sesiAbsensi.findFirst({
        where: { kodeUnik: kode, status: "terbuka" },
        orderBy: { openedAt: "desc" },
      });
      if (!s) {
        return NextResponse.json(
          { error: "Tidak ada sesi absensi aktif dengan kode tersebut." },
          { status: 404 }
        );
      }
      sesiId = s.id;
    }
  } else {
    return NextResponse.json(
      { error: "Scan QR atau masukkan kode unik." },
      { status: 400 }
    );
  }

  // ── 2. Validasi sesi di DB ─────────────────────────────────────
  const sesi = await prisma.sesiAbsensi.findUnique({
    where: { id: sesiId },
    include: { pertemuan: { include: { kelas: { include: { mataKuliah: true, dosen: { select: { userId: true } } } } } } },
  });
  if (!sesi) {
    return NextResponse.json({ error: "Sesi absensi tidak ditemukan." }, { status: 404 });
  }
  if (sesi.status !== "terbuka") {
    return NextResponse.json(
      { error: "Sesi absensi sudah ditutup oleh dosen." },
      { status: 400 }
    );
  }
  if (sesi.expiresAt < new Date()) {
    await prisma.sesiAbsensi.update({
      where: { id: sesi.id },
      data: { status: "ditutup", closedAt: new Date() },
    });
    return NextResponse.json(
      { error: "Sesi absensi sudah kedaluwarsa. Mintalah kode baru dari dosen." },
      { status: 400 }
    );
  }

  // Mahasiswa harus terdaftar di kelas ini
  const krs = await prisma.kRS.findFirst({
    where: {
      kelasId: sesi.kelasId,
      mahasiswaId: mahasiswa.id,
      status: "diambil",
    },
  });
  if (!krs) {
    return NextResponse.json(
      { error: `Anda tidak terdaftar di kelas ${sesi.pertemuan.kelas.mataKuliah.nama}.` },
      { status: 403 }
    );
  }

  // ── 3. Uniqueness: satu check-in per pertemuan ─────────────────
  const sudah = await prisma.absensi.findUnique({
    where: {
      pertemuanId_mahasiswaId: {
        pertemuanId: sesi.pertemuanId,
        mahasiswaId: mahasiswa.id,
      },
    },
  });
  if (sudah) {
    return NextResponse.json(
      {
        error: `Anda sudah absen untuk pertemuan ini dengan status "${sudah.status}".`,
        status: sudah.status,
      },
      { status: 409 }
    );
  }

  // ── 4. Validasi lokasi (opsional, bila dosen aktifkan) ─────────
  if (sesi.lokasiWajib) {
    if (
      sesi.latitude == null ||
      sesi.longitude == null ||
      body.latitude == null ||
      body.longitude == null
    ) {
      return NextResponse.json(
        { error: "Dosen mewajibkan lokasi. Izinkan akses lokasi peramban Anda." },
        { status: 400 }
      );
    }
    const jarak = jarakMeter(
      body.latitude,
      body.longitude,
      sesi.latitude,
      sesi.longitude
    );
    if (jarak > sesi.radiusMeter) {
      return NextResponse.json(
        {
          error: `Anda berada ${Math.round(jarak)} m dari ruang kelas (maksimal ${sesi.radiusMeter} m).`,
        },
        { status: 403 }
      );
    }
  }

  // ── Check-in ───────────────────────────────────────────────────
  const absensi = await prisma.absensi.create({
    data: {
      sesiId: sesi.id,
      pertemuanId: sesi.pertemuanId,
      mahasiswaId: mahasiswa.id,
      status: "hadir",
      metode: body.token ? "qr" : "kode",
      lokasiLat: body.latitude ?? null,
      lokasiLng: body.longitude ?? null,
    },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "absensi",
    entityId: absensi.id,
    newValue: { status: "hadir", pertemuanId: sesi.pertemuanId },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  broadcastNotifikasi(
    {
      judul: "Check-in tercatat",
      pesan: `${mahasiswa.nama} hadir — ${sesi.pertemuan.kelas.mataKuliah.nama} (P${sesi.pertemuan.nomor}).`,
      link: "/dosen/absensi",
    },
    [sesi.pertemuan.kelas.dosen.userId]
  );

  return NextResponse.json({
    ok: true,
    absensi: {
      id: absensi.id,
      status: absensi.status,
      checkInAt: absensi.checkInAt,
      mataKuliah: sesi.pertemuan.kelas.mataKuliah.nama,
      pertemuan: sesi.pertemuan.nomor,
    },
  });
}
