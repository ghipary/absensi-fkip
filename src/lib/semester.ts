/**
 * Utilitas pemetaan "semester ke-" (1–8) terhadap paritas semester.
 *
 * Aturan: semester Ganjil hanya memuat semester ke- ganjil (1, 3, 5, 7);
 * semester Genap hanya memuat semester ke- genap (2, 4, 6, 8).
 *
 * Modul ini murni (tanpa Prisma) agar aman dipakai di komponen klien maupun
 * di API route.
 */
import type { NamaSemester } from "@prisma/client";

export type JenisSemester = NamaSemester; // "Ganjil" | "Genap"

export const SEMESTER_GANJIL = [1, 3, 5, 7] as const;
export const SEMESTER_GENAP = [2, 4, 6, 8] as const;

/** Daftar semester ke- yang sah untuk jenis semester tertentu. */
export function opsiSemesterKe(jenis: JenisSemester | string): number[] {
  return jenis === "Genap" ? [...SEMESTER_GENAP] : [...SEMESTER_GANJIL];
}

/** Jenis semester dari sebuah semester ke- (ganjil → Ganjil, genap → Genap). */
export function paritasSemesterKe(semesterKe: number): JenisSemester {
  return semesterKe % 2 === 1 ? "Ganjil" : "Genap";
}

/** Apakah semester ke- cocok dengan paritas jenis semester. */
export function cocokParitas(
  semesterKe: number,
  jenis: JenisSemester | string
): boolean {
  return opsiSemesterKe(jenis).includes(semesterKe);
}

/** Label ringkas, mis. "Semester 5" atau "Belum dipetakan". */
export function labelSemesterKe(semesterKe: number | null | undefined): string {
  return typeof semesterKe === "number"
    ? `Semester ${semesterKe}`
    : "Belum dipetakan";
}

/** Opsi siap pakai untuk <Select> berdasarkan jenis semester. */
export function opsiSelectSemesterKe(jenis: JenisSemester | string) {
  return opsiSemesterKe(jenis).map((n) => ({
    value: String(n),
    label: `Semester ${n}`,
  }));
}

/**
 * Validasi nilai `semesterKe` dari input pengguna terhadap paritas.
 * Kosong/null diperbolehkan (mengosongkan peta).
 */
export function validasiSemesterKe(
  nilai: unknown,
  jenis: JenisSemester | string,
  label = "Semester ke"
): { ok: true; value: number | null } | { ok: false; pesan: string } {
  if (nilai === null || nilai === undefined || nilai === "") {
    return { ok: true, value: null };
  }
  const n = typeof nilai === "number" ? nilai : Number(String(nilai).trim());
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    return { ok: false, pesan: `${label} harus angka 1–8.` };
  }
  if (!cocokParitas(n, jenis)) {
    return {
      ok: false,
      pesan:
        `${label} ${n} tidak cocok dengan semester ${jenis} — ` +
        `pilih ${opsiSemesterKe(jenis).join(", ")}.`,
    };
  }
  return { ok: true, value: n };
}
