import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { kirimNotifikasi } from "@/lib/notifikasi";
import {
  hitungAkhir,
  hitungGrade,
  snapshotNilai,
  parseSnapshot,
  snapshotSama,
} from "@/lib/grade";

type BarisInput = {
  mahasiswaId?: string;
  tugas?: number | null;
  uts?: number | null;
  uas?: number | null;
};

/**
 * POST /api/nilai — dosen/kaprodi menyimpan nilai satu kelas (batch).
 * Body: { kelasId, alasan?, baris: BarisInput[] }
 *
 * Aturan versioning:
 * - Input pertama (baris Nilai belum ada) → riwayat status "otomatis", langsung berlaku.
 * - Perubahan nilai yang sudah ada → riwayat status "menunggu" (butuh validasi kaprodi),
 *   nilai tetap diterapkan segera karena dosen berwenang atas kelasnya.
 * - Nilai tidak pernah dihapus — hanya ditimpa, riwayat selalu tercatat.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "dosen" && user.role !== "kaprodi")) {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  let body: { kelasId?: string; alasan?: string; baris?: BarisInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const kelasId = body.kelasId?.trim();
  const baris = body.baris;
  if (!kelasId || !Array.isArray(baris)) {
    return NextResponse.json(
      { error: "Kelas dan daftar nilai wajib diisi." },
      { status: 400 }
    );
  }
  if (baris.length > 300) {
    return NextResponse.json(
      { error: "Terlalu banyak baris dalam satu permintaan." },
      { status: 400 }
    );
  }

  const alasan = body.alasan?.trim() || null;

  const kelas = await prisma.kelas.findFirst({
    where: { id: kelasId, deletedAt: null },
    select: {
      id: true,
      dosenId: true,
      bobotTugas: true,
      bobotUTS: true,
      bobotUAS: true,
      mataKuliah: { select: { kode: true, nama: true } },
    },
  });
  if (!kelas) {
    return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  }

  const dosen = await prisma.dosen.findUnique({ where: { userId: user.userId } });
  if (!dosen) {
    return NextResponse.json({ error: "Profil dosen tidak ditemukan." }, { status: 404 });
  }
  if (user.role !== "kaprodi" && kelas.dosenId !== dosen.id) {
    return NextResponse.json(
      { error: "Anda bukan pengampu kelas ini." },
      { status: 403 }
    );
  }

  // Validasi semua baris dulu
  const bersih: { mahasiswaId: string; tugas: number | null; uts: number | null; uas: number | null }[] = [];
  const idUnik = new Set<string>();
  for (const row of baris) {
    const mahasiswaId = row.mahasiswaId?.trim();
    if (!mahasiswaId) {
      return NextResponse.json({ error: "Setiap baris harus punya mahasiswa." }, { status: 400 });
    }
    if (idUnik.has(mahasiswaId)) continue; // abaikan duplikat
    idUnik.add(mahasiswaId);

    const angka = (v: number | null | undefined, label: string): number | null => {
      if (v === null || v === undefined) return null;
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`${label} bukan angka yang valid.`);
      }
      if (v < 0 || v > 100) {
        throw new Error(`${label} harus antara 0 dan 100.`);
      }
      return Math.round(v * 10) / 10;
    };

    let tugas: number | null, uts: number | null, uas: number | null;
    try {
      tugas = angka(row.tugas, "Nilai tugas");
      uts = angka(row.uts, "Nilai UTS");
      uas = angka(row.uas, "Nilai UAS");
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    bersih.push({ mahasiswaId, tugas, uts, uas });
  }

  // Pastikan semua mahasiswa ber-KRS di kelas ini
  const krs = await prisma.kRS.findMany({
    where: { kelasId, status: "diambil" },
    select: { mahasiswaId: true },
  });
  const setKrs = new Set(krs.map((k) => k.mahasiswaId));
  for (const row of bersih) {
    if (!setKrs.has(row.mahasiswaId)) {
      return NextResponse.json(
        { error: "Ada mahasiswa yang bukan peserta kelas ini." },
        { status: 400 }
      );
    }
  }

  const bobot = {
    bobotTugas: kelas.bobotTugas,
    bobotUTS: kelas.bobotUTS,
    bobotUAS: kelas.bobotUAS,
  };

  const lama = await prisma.nilai.findMany({
    where: { kelasId, mahasiswaId: { in: [...idUnik] } },
  });
  const petaLama = new Map(lama.map((n) => [n.mahasiswaId, n]));

  // Deteksi perubahan & wajibnya alasan
  type Rencana = {
    mahasiswaId: string;
    lama: (typeof lama)[number] | null;
    baru: ReturnType<typeof snapshotNilai>;
    berubah: boolean;
  };
  const rencana: Rencana[] = [];
  let adaEdit = false;

  for (const row of bersih) {
    const prev = petaLama.get(row.mahasiswaId) ?? null;
    const akhir = hitungAkhir(row.tugas, row.uts, row.uas, bobot);
    const grade = hitungGrade(akhir);
    const baru = snapshotNilai({ ...row, akhir, grade });
    const prevSnap = prev
      ? snapshotNilai({ tugas: prev.tugas, uts: prev.uts, uas: prev.uas, akhir: prev.akhir, grade: prev.grade })
      : null;
    const berubah = !prevSnap || !snapshotSama(prevSnap, baru);
    if (prev && berubah) adaEdit = true;
    rencana.push({ mahasiswaId: row.mahasiswaId, lama: prev, baru, berubah });
  }

  if (adaEdit && !alasan) {
    return NextResponse.json(
      { error: "Alasan wajib diisi untuk perubahan nilai yang sudah ada." },
      { status: 400 }
    );
  }
  if (alasan && alasan.length > 300) {
    return NextResponse.json(
      { error: "Alasan maksimal 300 karakter." },
      { status: 400 }
    );
  }

  const kini = new Date();
  const idRiwayatBaru: string[] = [];

  const hasil = await prisma.$transaction(async (tx) => {
    let diterapkan = 0;
    let menunggu = 0;

    for (const r of rencana) {
      if (!r.berubah) continue;

      const nilai = r.lama
        ? await tx.nilai.update({
            where: { id: r.lama.id },
            data: {
              tugas: r.baru.tugas,
              uts: r.baru.uts,
              uas: r.baru.uas,
              akhir: r.baru.akhir,
              grade: r.baru.grade as never,
              updatedById: dosen.id,
              updatedAt: kini,
            },
          })
        : await tx.nilai.create({
            data: {
              kelasId,
              mahasiswaId: r.mahasiswaId,
              tugas: r.baru.tugas,
              uts: r.baru.uts,
              uas: r.baru.uas,
              akhir: r.baru.akhir,
              grade: r.baru.grade as never,
              updatedById: dosen.id,
            },
          });

      // Satu entri riwayat per baris: snapshot lama → baru
      const prevSnap = r.lama
        ? snapshotNilai({
            tugas: r.lama.tugas,
            uts: r.lama.uts,
            uas: r.lama.uas,
            akhir: r.lama.akhir,
            grade: r.lama.grade,
          })
        : null;

      const status = r.lama ? "menunggu" : "otomatis";
      const riwayat = await tx.riwayatPerubahan.create({
        data: {
          tipe: "nilai",
          nilaiId: nilai.id,
          kelasId,
          mahasiswaId: r.mahasiswaId,
          field: "akhir",
          nilaiLama: prevSnap ? JSON.stringify(prevSnap) : null,
          nilaiBaru: JSON.stringify(r.baru),
          alasan,
          diubahOlehId: user.userId,
          status,
        },
      });
      idRiwayatBaru.push(riwayat.id);

      if (status === "menunggu") menunggu++;
      else diterapkan++;
    }

    await tx.auditLog.create({
      data: {
        userId: user.userId,
        aksi: "update",
        entityType: "nilai",
        entityId: kelasId,
        newValue: { jumlahBaris: diterapkan + menunggu, menunggu, alasan },
      },
    });

    return { diterapkan, menunggu };
  });

  // Notifikasi ke mahasiswa yang akhirnya berubah
  const berubahAkhir = rencana.filter((r) => {
    if (!r.berubah) return false;
    const prev = r.lama?.akhir ?? null;
    return prev !== r.baru.akhir;
  });
  if (berubahAkhir.length > 0) {
    const penerima = await prisma.mahasiswa.findMany({
      where: { id: { in: berubahAkhir.map((r) => r.mahasiswaId) } },
      select: { userId: true },
    });
    await kirimNotifikasi({
      userIds: penerima.map((m) => m.userId),
      tipe: "nilai",
      judul: `Nilai ${kelas.mataKuliah.kode} diperbarui`,
      pesan: alasan ?? "Dosen pengampu memperbarui nilai Anda.",
      link: "/mahasiswa/nilai",
    });
  }

  return NextResponse.json({
    ok: true,
    ...hasil,
    riwayatIds: idRiwayatBaru,
  });
}
