import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FAKULTAS: Array<{ nama: string }> = [
  { nama: "Fakultas Keguruan dan Ilmu Pendidikan" },
  { nama: "Fakultas Kesehatan" },
  { nama: "Fakultas Ekonomi" },
  { nama: "Fakultas Syariah" },
  { nama: "Fakultas Pertanian" },
  { nama: "Fakultas Teknik" },
];

const PRODI: Array<{ fakultas: string; nama: string; jenjang: string }> = [
  { fakultas: "Fakultas Keguruan dan Ilmu Pendidikan", nama: "Pendidikan Matematika", jenjang: "S1" },
  { fakultas: "Fakultas Keguruan dan Ilmu Pendidikan", nama: "Pendidikan Bahasa Inggris", jenjang: "S1" },
  { fakultas: "Fakultas Keguruan dan Ilmu Pendidikan", nama: "Pendidikan Kimia", jenjang: "S1" },
  { fakultas: "Fakultas Keguruan dan Ilmu Pendidikan", nama: "Pendidikan Guru PAUD", jenjang: "S1" },
  { fakultas: "Fakultas Kesehatan", nama: "Kebidanan", jenjang: "D3" },
  { fakultas: "Fakultas Kesehatan", nama: "Keperawatan", jenjang: "D3" },
  { fakultas: "Fakultas Ekonomi", nama: "Akuntansi", jenjang: "S1" },
  { fakultas: "Fakultas Ekonomi", nama: "Manajemen", jenjang: "S1" },
  { fakultas: "Fakultas Syariah", nama: "Ahwalus Syakhshiyah / Hukum Keluarga Islam", jenjang: "S1" },
  { fakultas: "Fakultas Pertanian", nama: "Agribisnis", jenjang: "S1" },
  { fakultas: "Fakultas Pertanian", nama: "Agroteknologi", jenjang: "S1" },
  { fakultas: "Fakultas Teknik", nama: "Teknik Informatika", jenjang: "S1" },
  { fakultas: "Fakultas Teknik", nama: "Teknik Industri", jenjang: "S1" },
  { fakultas: "Fakultas Teknik", nama: "Teknik Sipil", jenjang: "S1" },
  { fakultas: "Fakultas Teknik", nama: "Teknik Mesin", jenjang: "S1" },
];

async function main() {
  const pwd = await bcrypt.hash("password123", 10);

  const mapFak = new Map<string, string>();
  const mapProdi = new Map<string, string>();
  for (const f of FAKULTAS) {
    let fa = await prisma.fakultas.findFirst({ where: { nama: f.nama } });
    if (!fa) fa = await prisma.fakultas.create({ data: { nama: f.nama } });
    mapFak.set(f.nama, fa.id);
  }
  for (const p of PRODI) {
    const fid = mapFak.get(p.fakultas)!;
    let pr = await prisma.prodi.findFirst({ where: { fakultasId: fid, nama: p.nama, jenjang: p.jenjang } });
    if (!pr) pr = await prisma.prodi.create({ data: { fakultasId: fid, nama: p.nama, jenjang: p.jenjang } });
    mapProdi.set(`${p.fakultas}|${p.nama}`, pr.id);
  }

  const fidFkip = mapFak.get("Fakultas Keguruan dan Ilmu Pendidikan")!;
  const pidPmk = mapProdi.get("Fakultas Keguruan dan Ilmu Pendidikan|Pendidikan Matematika")!;

  await prisma.user.upsert({
    where: { email: "kaprodi@wahidiyah.ac.id" },
    create: { identitas: "KAPRODI01", nama: "Kaprodi PMK", email: "kaprodi@wahidiyah.ac.id", passwordHash: pwd, role: "kaprodi", fakultasId: fidFkip, prodiId: pidPmk },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "muhammad.fauzi@wahidiyah.ac.id" },
    create: { identitas: "199001052015031007", nama: "Muhammad Fauzi, M.Pd.", email: "muhammad.fauzi@wahidiyah.ac.id", passwordHash: pwd, role: "dosen", fakultasId: fidFkip, prodiId: pidPmk },
    update: {},
  });
  await prisma.dosen.upsert({
    where: { nidn: "199001052015031007" },
    create: { nidn: "199001052015031007", nama: "Muhammad Fauzi, M.Pd.", fakultasId: fidFkip, prodiId: pidPmk, jabatan: "Asisten Ahli" },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "mahasiswa1@wahidiyah.ac.id" },
    create: { identitas: "23101001", nama: "Ahmad Fauzi", email: "mahasiswa1@wahidiyah.ac.id", passwordHash: pwd, role: "mahasiswa", fakultasId: fidFkip, prodiId: pidPmk },
    update: {},
  });
  await prisma.mahasiswa.upsert({
    where: { nim: "23101001" },
    create: { nim: "23101001", nama: "Ahmad Fauzi", fakultasId: fidFkip, prodiId: pidPmk, angkatan: 2023, status: "aktif" },
    update: {},
  });

  await prisma.user.upsert({
    where: { email: "admin@wahidiyah.ac.id" },
    create: { identitas: "ADMIN01", nama: "Administrator", email: "admin@wahidiyah.ac.id", passwordHash: pwd, role: "admin", aktif: true },
    update: {},
  });

  const mk = await prisma.mataKuliah.upsert({
    where: { kodeMk: "PMK2101" },
    create: { kodeMk: "PMK2101", namaMk: "Kalkulus I", sks: 3 },
    update: {},
  });
  const dosen = await prisma.dosen.findUnique({ where: { nidn: "199001052015031007" } });
  await prisma.jadwal.upsert({
    where: { kodeMk_kelas_semester: { kodeMk: "PMK2101", kelas: "A", semester: "2025/2026 Ganjil" } },
    create: { kodeMk: "PMK2101", kelas: "A", nidnDosen: "199001052015031007", ruang: "R1", hari: "Senin", jamMulai: "08:00", jamSelesai: "09:40", semester: "2025/2026 Ganjil" },
    update: {},
  });
  const jad = await prisma.jadwal.findFirst({ where: { kodeMk: "PMK2101", kelas: "A" } });
  if (jad) {
    await prisma.materi.upsert({
      where: { id: "demo" },
      create: { id: "demo", jadwalId: jad.id, judul: "Kontrak Kuliah", deskripsi: "Aturan dan rencana perkuliahan", dibuatOleh: "199001052015031007", fileUrl: "/uploads/materi/kontrak.pdf" },
      update: {},
    }).catch(async () => {
      await prisma.materi.create({ data: { jadwalId: jad.id, judul: "Kontrak Kuliah", deskripsi: "Aturan dan rencana perkuliahan", dibuatOleh: "199001052015031007", fileUrl: "/uploads/materi/kontrak.pdf" } });
    });
  }

  console.log("Seed selesai");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
