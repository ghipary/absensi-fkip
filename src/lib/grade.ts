import type { Grade } from "@prisma/client";

/**
 * Kalkulasi akademik.
 * Default: tugas 30% · UTS 30% · UAS 40% (bisa beda per kelas).
 * Grade (skala 4.0): A≥80 B≥70 C≥60 D≥50 E<50.
 */

export type Bobot = { bobotTugas: number; bobotUTS: number; bobotUAS: number };

export function hitungAkhir(
  tugas: number | null,
  uts: number | null,
  uas: number | null,
  bobot: Bobot
): number | null {
  if (uts === null || uas === null) return null; // tugas boleh belum lengkap
  const t = tugas ?? 0;
  return Math.round((t * bobot.bobotTugas + uts * bobot.bobotUTS + uas * bobot.bobotUAS) * 10) / 10;
}

export function hitungGrade(akhir: number | null): Grade | null {
  if (akhir === null) return null;
  if (akhir >= 80) return "A";
  if (akhir >= 70) return "B";
  if (akhir >= 60) return "C";
  if (akhir >= 50) return "D";
  return "E";
}

export const BOBOT_ANGKA: Record<Grade, number> = {
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  E: 0,
};

/** IPK = Σ(akhir × sks) / Σ(sks) — hanya kelas berstatus lulus */
export function hitungIpk(
  rows: { akhir: number | null; sks: number }[]
): number {
  let totalBobot = 0;
  let totalSks = 0;
  for (const r of rows) {
    if (r.akhir === null) continue;
    totalBobot += r.akhir * r.sks;
    totalSks += r.sks;
  }
  if (totalSks === 0) return 0;
  return Math.round((totalBobot / totalSks) * 100) / 100;
}

/**
 * Snapshot nilai untuk riwayat_perubahan (versioning).
 * Disimpan sebagai JSON string di field nilaiLama/nilaiBaru.
 */
export type SnapshotNilai = {
  tugas: number | null;
  uts: number | null;
  uas: number | null;
  akhir: number | null;
  grade: string | null;
};

export function snapshotNilai(n: SnapshotNilai): SnapshotNilai {
  return {
    tugas: n.tugas,
    uts: n.uts,
    uas: n.uas,
    akhir: n.akhir,
    grade: n.grade,
  };
}

export function parseSnapshot(json: string | null): SnapshotNilai | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as SnapshotNilai;
    if (typeof v !== "object" || v === null) return null;
    return {
      tugas: v.tugas ?? null,
      uts: v.uts ?? null,
      uas: v.uas ?? null,
      akhir: v.akhir ?? null,
      grade: v.grade ?? null,
    };
  } catch {
    return null;
  }
}

export function snapshotSama(a: SnapshotNilai, b: SnapshotNilai): boolean {
  return (
    a.tugas === b.tugas &&
    a.uts === b.uts &&
    a.uas === b.uas &&
    a.akhir === b.akhir &&
    a.grade === b.grade
  );
}

/**
 * Persentase kehadiran vs syarat minimal 75%.
 * Menghasilkan detail yang bisa langsung ditampilkan ke mahasiswa.
 */
export function statistikKehadiran(total: number, hadir: number) {
  // Anomali data (hadir > total) dikunci agar tidak pernah >100%.
  const h = hadir > total ? total : Math.max(0, hadir);
  const persen = total === 0 ? 100 : Math.min(100, Math.round((h / total) * 1000) / 10);
  const butuh = Math.max(0, Math.ceil(total * 0.75) - h);
  return {
    persen,
    memenuhi: persen >= 75,
    butuhHadir: butuh, // berapa kali lagi harus hadir
    sisa: Math.max(0, total - h), // pertemuan tersisa (upper bound)
    minimal75: Math.ceil(total * 0.75),
  };
}
