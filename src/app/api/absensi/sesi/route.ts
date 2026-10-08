import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { signQrToken, urlCheckIn } from "@/lib/qr-token";
import { catatAudit } from "@/lib/audit";
import { userIdPesertaKelas } from "@/lib/notifikasi";
import { broadcastNotifikasi } from "@/lib/sse-bus";

/**
 * POST /api/absensi/sesi — dosen membuka sesi absensi (QR + kode unik)
 * Body: { pertemuanId, metode: "qr"|"kode", menitBerlaku?, lokasiWajib?, latitude?, longitude?, radiusMeter? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: {
    pertemuanId?: string;
    metode?: "qr" | "kode";
    menitBerlaku?: number;
    lokasiWajib?: boolean;
    latitude?: number;
    longitude?: number;
    radiusMeter?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  if (!body.pertemuanId) {
    return NextResponse.json({ error: "Pertemuan wajib dipilih." }, { status: 400 });
  }

  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: body.pertemuanId },
    include: { kelas: { include: { mataKuliah: true } }, sesiAbsensi: true },
  });
  if (!pertemuan) {
    return NextResponse.json({ error: "Pertemuan tidak ditemukan." }, { status: 404 });
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) {
    return NextResponse.json({ error: "Profil dosen tidak ditemukan." }, { status: 404 });
  }
  // Hanya pengampu kelas ini (kaprodi boleh ikut campur untuk perbaikan)
  if (pertemuan.kelas.dosenId !== dosen.id && user.role !== "kaprodi") {
    return NextResponse.json(
      { error: "Anda bukan pengampu kelas ini." },
      { status: 403 }
    );
  }

  // Tutup sesi terbuka sebelumnya bila ada
  const terbuka = pertemuan.sesiAbsensi.find((s) => s.status === "terbuka");
  const menit = Math.min(Math.max(body.menitBerlaku ?? 10, 1), 60);
  const expiresAt = new Date(Date.now() + menit * 60_000);

  let sesi;
  if (terbuka) {
    // Perpanjang sesi yang sudah ada — tanda tangan QR ikut diperbarui
    sesi = await prisma.sesiAbsensi.update({
      where: { id: terbuka.id },
      data: {
        expiresAt,
        metode: body.metode ?? "qr",
        token: signQrToken(terbuka.id, expiresAt),
      },
    });
  } else {
    sesi = await prisma.sesiAbsensi.create({
      data: {
        pertemuanId: pertemuan.id,
        kelasId: pertemuan.kelasId,
        dosenId: dosen.id,
        metode: body.metode ?? "qr",
        token: "pending", // diisi setelah id sesi tersedia
        kodeUnik: String(Math.floor(100000 + Math.random() * 900000)),
        expiresAt,
        lokasiWajib: body.lokasiWajib ?? false,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        radiusMeter: body.radiusMeter ?? 100,
      },
    });
    // Sign ulang dengan id sesi asli
    const tokenFinal = signQrToken(sesi.id, expiresAt);
    sesi = await prisma.sesiAbsensi.update({
      where: { id: sesi.id },
      data: { token: tokenFinal },
    });
  }

  await catatAudit({
    userId: user.userId,
    aksi: "create",
    entityType: "sesi_absensi",
    entityId: sesi.id,
    newValue: { pertemuanId: pertemuan.id, expiresAt, metode: sesi.metode },
    ipAddress: req.headers.get("x-forwarded-for"),
  });

  const qrUrl = urlCheckIn(sesi.id, sesi.token);

  const sasaranMahasiswa = await userIdPesertaKelas(pertemuan.kelasId);
  broadcastNotifikasi(
    {
      judul: `Absensi dibuka — ${pertemuan.kelas.mataKuliah.nama}`,
      pesan: `Pertemuan ke-${pertemuan.nomor}. Scan QR atau masukkan kode unik.`,
      link: "/mahasiswa/absensi",
    },
    sasaranMahasiswa
  );

  return NextResponse.json({
    ok: true,
    sesi: {
      id: sesi.id,
      kodeUnik: sesi.kodeUnik,
      qrUrl,
      expiresAt: sesi.expiresAt,
      metode: sesi.metode,
      lokasiWajib: sesi.lokasiWajib,
    },
  });
}

/**
 * DELETE /api/absensi/sesi?id=... — dosen menutup sesi lebih awal
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID sesi wajib." }, { status: 400 });
  }

  const sesi = await prisma.sesiAbsensi.findUnique({ where: { id } });
  if (!sesi) {
    return NextResponse.json({ error: "Sesi tidak ditemukan." }, { status: 404 });
  }

  await prisma.sesiAbsensi.update({
    where: { id },
    data: { status: "ditutup", closedAt: new Date() },
  });

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: "sesi_absensi",
    entityId: id,
    oldValue: { status: "terbuka" },
    newValue: { status: "ditutup" },
  });

  return NextResponse.json({ ok: true });
}
