import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi } from "@/lib/notifikasi";
import { hitungAkhir, hitungGrade, snapshotNilai, parseSnapshot } from "@/lib/grade";

/**
 * POST /api/validasi — kaprodi menyetujui/menolak perubahan yang berstatus "menunggu".
 * Body: { riwayatId, aksi: "setujui" | "tolak" }
 *
 * - setujui: status → disetujui, nilai tetap seperti yang diterapkan dosen.
 * - tolak:   status → ditolak, nilai DIKEMBALIKAN ke nilaiLama snapshot,
 *            lalu dicatat sebagai riwayat baru (riwayat tidak pernah dihapus).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: { riwayatId?: string; aksi?: "setujui" | "tolak" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const riwayatId = body.riwayatId?.trim();
  if (!riwayatId || (body.aksi !== "setujui" && body.aksi !== "tolak")) {
    return NextResponse.json(
      { error: "Entri riwayat dan aksi wajib diisi." },
      { status: 400 }
    );
  }

  const riwayat = await prisma.riwayatPerubahan.findUnique({
    where: { id: riwayatId },
    include: {
      nilai: {
        include: {
          kelas: {
            select: {
              dosenId: true,
              bobotTugas: true,
              bobotUTS: true,
              bobotUAS: true,
              mataKuliah: { select: { kode: true, nama: true } },
            },
          },
        },
      },
      pelaku: { select: { id: true } },
    },
  });

  if (!riwayat) {
    return NextResponse.json({ error: "Entri riwayat tidak ditemukan." }, { status: 404 });
  }
  if (riwayat.status !== "menunggu") {
    return NextResponse.json(
      { error: "Entri ini sudah diproses sebelumnya." },
      { status: 409 }
    );
  }

  const kini = new Date();
  let nilaiDikembalikan: unknown = null;

  if (body.aksi === "setujui") {
    await prisma.$transaction([
      prisma.riwayatPerubahan.update({
        where: { id: riwayat.id },
        data: { status: "disetujui", reviewedById: user.userId, reviewedAt: kini },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.userId,
          aksi: "approve",
          entityType: "riwayat_perubahan",
          entityId: riwayat.id,
          oldValue: { status: "menunggu" },
          newValue: { status: "disetujui" },
        },
      }),
    ]);
  } else {
    // Tolak → kembalikan nilai ke snapshot lama
    if (!riwayat.nilai || !riwayat.nilaiLama || !riwayat.nilaiId) {
      return NextResponse.json(
        { error: "Entri ini tidak memiliki nilai lama untuk dikembalikan." },
        { status: 400 }
      );
    }
    const target = parseSnapshot(riwayat.nilaiLama);
    if (!target) {
      return NextResponse.json(
        { error: "Snapshot nilai lama tidak terbaca." },
        { status: 500 }
      );
    }
    const bobot = {
      bobotTugas: riwayat.nilai.kelas.bobotTugas,
      bobotUTS: riwayat.nilai.kelas.bobotUTS,
      bobotUAS: riwayat.nilai.kelas.bobotUAS,
    };
    const akhir = hitungAkhir(target.tugas, target.uts, target.uas, bobot);
    const grade = hitungGrade(akhir);
    const dikembalikan = snapshotNilai({
      tugas: target.tugas,
      uts: target.uts,
      uas: target.uas,
      akhir,
      grade,
    });
    const sebelum = snapshotNilai({
      tugas: riwayat.nilai.tugas,
      uts: riwayat.nilai.uts,
      uas: riwayat.nilai.uas,
      akhir: riwayat.nilai.akhir,
      grade: riwayat.nilai.grade,
    });
    nilaiDikembalikan = dikembalikan;

    await prisma.$transaction(async (tx) => {
      await tx.nilai.update({
        where: { id: riwayat.nilaiId! },
        data: {
          tugas: dikembalikan.tugas,
          uts: dikembalikan.uts,
          uas: dikembalikan.uas,
          akhir: dikembalikan.akhir,
          grade: grade as never,
          updatedById: user.userId,
        },
      });
      await tx.riwayatPerubahan.update({
        where: { id: riwayat.id },
        data: { status: "ditolak", reviewedById: user.userId, reviewedAt: kini },
      });
      await tx.riwayatPerubahan.create({
        data: {
          tipe: "nilai",
          nilaiId: riwayat.nilaiId,
          kelasId: riwayat.kelasId,
          mahasiswaId: riwayat.mahasiswaId,
          field: "akhir",
          nilaiLama: JSON.stringify(sebelum),
          nilaiBaru: JSON.stringify(dikembalikan),
          alasan: "Penolakan validasi kaprodi — nilai dikembalikan",
          diubahOlehId: user.userId,
          status: "otomatis",
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          aksi: "reject",
          entityType: "riwayat_perubahan",
          entityId: riwayat.id,
          oldValue: { status: "menunggu" },
          newValue: { status: "ditolak", nilai: dikembalikan },
        },
      });
    });

    // Kabari pengampu + mahasiswa terkait
    const penerima = await prisma.mahasiswa.findMany({
      where: { id: riwayat.mahasiswaId ?? "__none__" },
      select: { userId: true },
    });
    await kirimNotifikasi({
      userIds: [
        ...penerima.map((m) => m.userId),
        ...(riwayat.nilai.updatedById
          ? [await userIdDariDosen(riwayat.nilai.updatedById)]
          : []),
      ].filter((id): id is string => id !== null),
      tipe: "nilai",
      judul: `Perubahan nilai ${riwayat.nilai.kelas.mataKuliah.kode} ditolak`,
      pesan: "Kaprodi menolak perubahan nilai — nilai dikembalikan ke sebelumnya.",
      link: "/mahasiswa/nilai",
    });
  }

  return NextResponse.json({ ok: true, aksi: body.aksi, nilai: nilaiDikembalikan });
}

async function userIdDariDosen(dosenId: string): Promise<string | null> {
  const d = await prisma.dosen.findUnique({
    where: { id: dosenId },
    select: { userId: true },
  });
  return d?.userId ?? null;
}
