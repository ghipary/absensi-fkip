import type { AcademicProvider, MahasiswaDTO, DosenDTO, JadwalDTO, IdentitasDTO } from "./provider";

const MAHASISWA: MahasiswaDTO[] = [
  { nim: "23101001", nama: "Ahmad Fauzi", fakultas: "Fakultas Keguruan dan Ilmu Pendidikan", prodi: "Pendidikan Matematika", angkatan: 2023, status: "aktif" },
];
const DOSEN: DosenDTO[] = [
  { nidn: "199001052015031007", nama: "Muhammad Fauzi, M.Pd.", fakultas: "Fakultas Keguruan dan Ilmu Pendidikan", prodi: "Pendidikan Matematika", jabatan: "Asisten Ahli" },
];
const JADWAL: JadwalDTO[] = [
  { kodeMk: "PMK2101", mataKuliah: "Kalkulus I", dosen: "Muhammad Fauzi, M.Pd.", kelas: "A", ruang: "R1", hari: "Senin", jamMulai: "08:00", jamSelesai: "09:40", semester: "2025/2026 Ganjil" },
];

export const mockProvider: AcademicProvider = {
  async getMahasiswa(filter) {
    if (!filter) return MAHASISWA;
    return MAHASISWA.filter((m) =>
      Object.entries(filter).every(([k, v]) => (m as any)[k] === v)
    );
  },
  async getDosen(filter) {
    if (!filter) return DOSEN;
    return DOSEN.filter((d) =>
      Object.entries(filter).every(([k, v]) => (d as any)[k] === v)
    );
  },
  async getJadwal(filter) {
    if (!filter) return JADWAL;
    return JADWAL.filter((j) =>
      Object.entries(filter).every(([k, v]) => (j as any)[k] === v)
    );
  },
  async verifikasiIdentitas(input) {
    const email = String(input?.email || "").toLowerCase();
    const pwd = String(input?.password || "");
    if (pwd !== "password123") return null;
    if (email === "kaprodi@wahidiyah.ac.id") {
      return { identitas: "KAPRODI01", nama: "Kaprodi PMK", email, role: "kaprodi", fakultasId: "", prodiId: "" };
    }
    if (email === "muhammad.fauzi@wahidiyah.ac.id") {
      return { identitas: "199001052015031007", nama: "Muhammad Fauzi, M.Pd.", email, role: "dosen", fakultasId: "", prodiId: "" };
    }
    if (email === "mahasiswa1@wahidiyah.ac.id") {
      return { identitas: "23101001", nama: "Ahmad Fauzi", email, role: "mahasiswa", fakultasId: "", prodiId: "" };
    }
    if (email === "admin@wahidiyah.ac.id") {
      return { identitas: "ADMIN01", nama: "Administrator", email, role: "admin", fakultasId: "", prodiId: "" };
    }
    return null;
  },
};
