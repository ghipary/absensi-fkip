import type { AcademicProvider, MahasiswaDTO, DosenDTO, JadwalDTO, IdentitasDTO } from "./provider";

const baseUrl = process.env.WEB_A_BASE_URL || "";

export const apiProvider: AcademicProvider = {
  async getMahasiswa(filter) {
    const qs = filter ? "?" + new URLSearchParams(filter as any).toString() : "";
    const res = await fetch(`${baseUrl}/api/mahasiswa${qs}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data ?? [];
  },
  async getDosen(filter) {
    const qs = filter ? "?" + new URLSearchParams(filter as any).toString() : "";
    const res = await fetch(`${baseUrl}/api/dosen${qs}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data ?? [];
  },
  async getJadwal(filter) {
    const qs = filter ? "?" + new URLSearchParams(filter as any).toString() : "";
    const res = await fetch(`${baseUrl}/api/jadwal${qs}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data?.data ?? [];
  },
  async verifikasiIdentitas(input) {
    // OIDC: Web A akan memverifikasi token
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.identitas ?? null;
  },
};
