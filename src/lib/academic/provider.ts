// AcademicProvider: adapter data master dari Web A (read-only)
// mode mock | api, dikontrol via DATA_SOURCE

import type { Role } from "../konstanta";

export interface IdentitasDTO {
  identitas: string;
  nama: string;
  email?: string;
  role: Role;
  fakultasId?: string | null;
  prodiId?: string | null;
}

export interface MahasiswaDTO {
  nim: string;
  nama: string;
  fakultas: string;
  prodi: string;
  angkatan: number;
  status: string;
}

export interface DosenDTO {
  nidn: string;
  nama: string;
  fakultas: string;
  prodi: string;
  jabatan?: string | null;
}

export interface JadwalDTO {
  kodeMk: string;
  mataKuliah: string;
  dosen: string;
  kelas: string;
  ruang: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  semester: string;
}

export interface AcademicProvider {
  getMahasiswa(filter?: Partial<MahasiswaDTO>): Promise<MahasiswaDTO[]>;
  getDosen(filter?: Partial<DosenDTO>): Promise<DosenDTO[]>;
  getJadwal(filter?: Partial<JadwalDTO>): Promise<JadwalDTO[]>;
  verifikasiIdentitas(input: any): Promise<IdentitasDTO | null>;
}

const dataSource = (process.env.DATA_SOURCE || "mock") as "mock" | "api";

export async function createAcademicProvider(): Promise<AcademicProvider> {
  if (dataSource === "api") {
    const { apiProvider } = await import("./api");
    return apiProvider;
  }
  const { mockProvider } = await import("./mock");
  return mockProvider;
}
