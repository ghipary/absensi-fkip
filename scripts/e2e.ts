/**
 * Smoke test end-to-end — jalankan setelah `npm run build` + `npm start`.
 *   npx tsx scripts/e2e.ts
 *
 * Menguji: auth login/redirect RBAC, buka sesi absensi (QR + kode unik),
 * check-in kode, check-in token QR, duplikat 409, role salah 403, token
 * expired 400, sesi kadaluarsa, rendering halaman utama tiap peran,
 * plus alur tugas (buat → kumpul → nilai → sinkron nilai kelas) dan
 * alur nilai (versioning riwayat, validasi kaprodi, undo).
 */
import { prisma } from "../src/lib/prisma";
import { muatRincianKehadiran } from "../src/lib/kehadiran";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";

const BASE = process.env.E2E_URL ?? "http://localhost:3000";

let lolos = 0;
let gagal = 0;

function cek(nama: string, kondisi: boolean, info = "") {
  if (kondisi) {
    lolos++;
    console.log(`  ✓ ${nama}`);
  } else {
    gagal++;
    console.log(`  ✗ ${nama}${info ? ` — ${info}` : ""}`);
  }
}

/** Cookie jar sederhana per sesi login */
function ambilCookie(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const pasangan = setCookies
    .filter((c) => c.startsWith("absensi_access="))
    .map((c) => c.split(";")[0]);
  return pasangan.join("; ");
}

async function login(email: string): Promise<{ cookie: string; role: string }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const data = await res.json();
  return { cookie: ambilCookie(res), role: data.role };
}

async function main() {
  console.log("\n── Auth & RBAC ──");

  // Root tanpa cookie → redirect ke /login
  const root = await fetch(`${BASE}/`, { redirect: "manual" });
  cek(
    "Root tanpa cookie → redirect login",
    [301, 302, 303, 307, 308].includes(root.status) &&
      (root.headers.get("location") ?? "").includes("/login"),
    `status ${root.status} loc ${root.headers.get("location")}`
  );

  // Route ber-role tanpa cookie → redirect ke /login?dari=...
  const mhsTanpa = await fetch(`${BASE}/mahasiswa`, { redirect: "manual" });
  cek(
    "/mahasiswa tanpa login → redirect",
    [301, 302, 303, 307, 308].includes(mhsTanpa.status),
    `status ${mhsTanpa.status}`
  );

  // Login mahasiswa
  const mhs = await login("mahasiswa1@wahidiyah.ac.id");
  cek("Login mahasiswa sukses", mhs.role === "mahasiswa" && !!mhs.cookie);

  // Mahasiswa mencoba akses /dosen → dialihkan ke /mahasiswa
  const cobaDosen = await fetch(`${BASE}/dosen`, {
    redirect: "manual",
    headers: { Cookie: mhs.cookie },
  });
  cek(
    "Mahasiswa buka /dosen → redirect ke /mahasiswa",
    [301, 302, 303, 307, 308].includes(cobaDosen.status) &&
      (cobaDosen.headers.get("location") ?? "").includes("/mahasiswa"),
    `status ${cobaDosen.status} loc ${cobaDosen.headers.get("location")}`
  );

  // API sesi dengan role salah → 403
  const sesiDitolak = await fetch(`${BASE}/api/absensi/sesi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mhs.cookie },
    body: JSON.stringify({ pertemuanId: "x" }),
  });
  cek("API sesi ditolak untuk mahasiswa (403)", sesiDitolak.status === 403);

  console.log("\n── Halaman utama per peran ──");
  for (const [email, path, patokan] of [
    ["mahasiswa1@wahidiyah.ac.id", "/mahasiswa", "Halo"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen", "Halo"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi", "Dashboard Eksekutif"],
    ["mahasiswa1@wahidiyah.ac.id", "/mahasiswa/absensi", "Absen masuk"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen/absensi", "Buka sesi absensi"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen/tugas", "Daftar tugas"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen/nilai", "Tabel nilai"],
    ["mahasiswa1@wahidiyah.ac.id", "/mahasiswa/tugas", "Tugas Saya"],
    ["mahasiswa1@wahidiyah.ac.id", "/mahasiswa/nilai", "Nilai Saya"],
    ["mahasiswa1@wahidiyah.ac.id", "/mahasiswa/profil", "Profil mahasiswa"],
    ["mahasiswa1@wahidiyah.ac.id", "/mahasiswa/jadwal", "Jadwal Kuliah"],
    ["mahasiswa1@wahidiyah.ac.id", "/mahasiswa/pengumuman", "Pengumuman"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen/jadwal", "Jadwal Mengajar"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen/rekap", "Rekap Kelas"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen/pengumuman", "Pengumuman"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/dosen/profil", "Profil Dosen"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi/kehadiran", "Monitoring Kehadiran"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi/dosen", "Monitoring Dosen"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi/laporan", "Laporan Akademik"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi/manajemen", "Manajemen Akademik"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi/pengumuman", "Pengumuman"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi/validasi", "Antrean menunggu validasi"],
    ["kaprodi@wahidiyah.ac.id", "/kaprodi/profil", "Profil Kaprodi"],
    ["mahasiswa1@wahidiyah.ac.id", "/kalender-akademik", "Kalender Akademik"],
    ["muhammad.fauzi@wahidiyah.ac.id", "/kalender-akademik", "Agenda semester"],
    ["kaprodi@wahidiyah.ac.id", "/kalender-akademik", "Tambah agenda"],
  ] as const) {
    const { cookie } = await login(email);
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const html = await res.text();
    cek(
      `${path} → 200 & render`,
      res.status === 200 && html.includes(patokan),
      `status ${res.status}${html.includes(patokan) ? "" : ` · kata "${patokan}" tidak ada`}`
    );
  }

  console.log("\n── Alur absensi lengkap ──");
  const dosen = await login("muhammad.fauzi@wahidiyah.ac.id");

  // Cari pertemuan Kalkulus I milik dosen ini (yang belum punya absensi)
  const dosenDb = await prisma.dosen.findUnique({
    where: { nip: "199001052015031007" },
    select: { id: true },
  });
  const kelas = await prisma.kelas.findFirst({
    where: { dosenId: dosenDb!.id, deletedAt: null },
    select: { id: true, pertemuan: { select: { id: true, nomor: true }, orderBy: { nomor: "desc" }, take: 1 } },
  });
  const pertemuanId = kelas!.pertemuan[0].id;

  // Setup e2e idempoten: bersihkan absensi pertemuan uji agar run berikutnya
  // selalu mulai dari keadaan kosong.
  await prisma.absensi.deleteMany({ where: { pertemuanId } });

  // Buka sesi
  const buka = await fetch(`${BASE}/api/absensi/sesi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({ pertemuanId, metode: "qr", menitBerlaku: 10 }),
  });
  const bukaData = await buka.json();
  cek("Dosen buka sesi absensi", buka.status === 200 && !!bukaData.sesi?.kodeUnik,
    `status ${buka.status} ${JSON.stringify(bukaData).slice(0, 120)}`);

  const sesiId: string = bukaData.sesi.id;
  const kode: string = bukaData.sesi.kodeUnik;
  const qrUrl: string = bukaData.sesi.qrUrl;

  // Check-in pertama: mahasiswa1 via KODE UNIK
  const m1 = await login("mahasiswa1@wahidiyah.ac.id");
  const cek1 = await fetch(`${BASE}/api/absensi/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m1.cookie },
    body: JSON.stringify({ kodeUnik: kode }),
  });
  const cek1Data = await cek1.json();
  cek(
    "Mahasiswa1 check-in via kode unik",
    cek1.status === 200 && cek1Data.absensi?.status === "hadir",
    `status ${cek1.status} ${cek1Data.error ?? ""}`
  );

  // Duplikat → 409
  const duplikat = await fetch(`${BASE}/api/absensi/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m1.cookie },
    body: JSON.stringify({ kodeUnik: kode }),
  });
  cek("Check-in duplikat ditolak (409)", duplikat.status === 409,
    `status ${duplikat.status}`);

  // Check-in kedua: mahasiswa2 via TOKEN QR (dari URL hasil scan)
  const u = new URL(qrUrl);
  const token = u.searchParams.get("t")!;
  const m2 = await login("mahasiswa2@wahidiyah.ac.id");
  const cek2 = await fetch(`${BASE}/api/absensi/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m2.cookie },
    body: JSON.stringify({ token, sesiId: u.searchParams.get("sesi") }),
  });
  const cek2Data = await cek2.json();
  cek(
    "Mahasiswa2 check-in via token QR",
    cek2.status === 200 && cek2Data.absensi?.status === "hadir",
    `status ${cek2.status} ${cek2Data.error ?? ""}`
  );

  // Token palsu → 400
  const palsu = await fetch(`${BASE}/api/absensi/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m2.cookie },
    body: JSON.stringify({ token: "aaaa.bbbb" }),
  });
  cek("Token QR palsu ditolak (400)", palsu.status === 400, `status ${palsu.status}`);

  // Daftar hadir sesi (dosen) → berisi 2
  const hadir = await fetch(`${BASE}/api/absensi/hadir?sesiId=${sesiId}`, {
    headers: { Cookie: dosen.cookie },
  });
  const hadirData = await hadir.json();
  cek("Daftar hadir sesi berisi 2 mahasiswa", hadirData.daftar?.length === 2,
    `jumlah ${hadirData.daftar?.length}`);

  // Tutup sesi → check-in berikutnya ditolak
  const tutup = await fetch(`${BASE}/api/absensi/sesi?id=${sesiId}`, {
    method: "DELETE",
    headers: { Cookie: dosen.cookie },
  });
  cek("Dosen tutup sesi", tutup.status === 200);
  const setelahTutup = await fetch(`${BASE}/api/absensi/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m2.cookie },
    body: JSON.stringify({ kodeUnik: kode }),
  });
  cek("Check-in setelah sesi ditutup ditolak", setelahTutup.status >= 400,
    `status ${setelahTutup.status}`);

  // Sesi kadaluarsa: buat sesi baru lalu paksa expiresAt lampau
  const buka2 = await fetch(`${BASE}/api/absensi/sesi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({ pertemuanId, metode: "kode", menitBerlaku: 5 }),
  });
  const buka2Data = await buka2.json();
  await prisma.sesiAbsensi.update({
    where: { id: buka2Data.sesi.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const kadaluarsa = await fetch(`${BASE}/api/absensi/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m2.cookie },
    body: JSON.stringify({ kodeUnik: buka2Data.sesi.kodeUnik }),
  });
  cek("Sesi expired → ditolak + ditutup otomatis", kadaluarsa.status === 400,
    `status ${kadaluarsa.status}`);

  console.log("\n── Alur tugas & nilai ──");

  // Peserta kelas kalkulus (untuk submit tugas)
  const pesertaKrs = await prisma.kRS.findMany({
    where: { kelasId: kelas!.id, status: "diambil" },
    include: {
      mahasiswa: {
        select: {
          id: true,
          nama: true,
          userId: true,
          user: { select: { email: true } },
        },
      },
    },
    orderBy: { mahasiswa: { nim: "asc" } },
    take: 10,
  });
  cek("Kelas punya peserta KRS", pesertaKrs.length >= 2, `jumlah ${pesertaKrs.length}`);

  // Pakai peserta berakun seed (kata sandi "password123") agar run tidak rapuh
  // terhadap akun non-seed yang mungkin juga ter-KRS di kelas ini.
  const pesertaUji =
    pesertaKrs.find((k) => k.mahasiswa.user.email.endsWith("@wahidiyah.ac.id")) ??
    pesertaKrs[0];

  // 1) Dosen membuat tugas
  const buatTugas = await fetch(`${BASE}/api/tugas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({
      kelasId: kelas!.id,
      judul: "E2E — Analisis Grafik Fungsi Kuadrat",
      deskripsi: "Analisis titik puncak, sumbu simetri, dan arah parabola.",
      deadlineAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      bobotPoin: 100,
      langsungTerbit: true,
    }),
  });
  const tugasData = await buatTugas.json();
  const tugasId: string | undefined = tugasData.tugas?.id;
  cek(
    "Dosen membuat + publikasi tugas",
    buatTugas.status === 201 && !!tugasId,
    `status ${buatTugas.status} ${tugasData.error ?? ""}`
  );
  if (!tugasId) throw new Error("tugas gagal dibuat — hentikan alur tugas");

  // 2) Mahasiswa peserta mengumpulkan
  const mhsPeserta = await login(pesertaUji.mahasiswa.user.email);
  const kumpul = await fetch(`${BASE}/api/tugas/${tugasId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mhsPeserta.cookie },
    body: JSON.stringify({
      teks: "Parabola terbuka ke atas, titik puncak (2, -1).",
      linkUrl: "https://example.com/analisis-grafik.png",
    }),
  });
  const kumpulData = await kumpul.json();
  const submissionId: string | undefined = kumpulData.submission?.id;
  cek(
    "Mahasiswa peserta mengumpulkan tugas",
    kumpul.status === 201 && !!submissionId && kumpulData.isTerlambat === false,
    `status ${kumpul.status} ${kumpulData.error ?? ""}`
  );

  // 3) Submit ulang boleh (belum dinilai) → 200
  const kumpulUlang = await fetch(`${BASE}/api/tugas/${tugasId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mhsPeserta.cookie },
    body: JSON.stringify({ teks: "Revisi: puncak (2, -1), membuka ke atas.", linkUrl: "" }),
  });
  const ulangData = await kumpulUlang.json();
  cek(
    "Submit ulang sebelum dinilai diperbolehkan",
    kumpulUlang.status === 200,
    `status ${kumpulUlang.status} ${ulangData.error ?? ""}`
  );

  // 4) Mahasiswa membuat tugas → ditolak
  const mhs2 = await login("mahasiswa2@wahidiyah.ac.id");
  const cobaTugas = await fetch(`${BASE}/api/tugas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mhs2.cookie },
    body: JSON.stringify({ kelasId: kelas!.id, judul: "Tugas ilegal" }),
  });
  cek("Mahasiswa membuat tugas → ditolak (403)", cobaTugas.status === 403,
    `status ${cobaTugas.status}`);

  // Setup e2e: pastikan baris Nilai mahasiswa ini belum punya nilai akhir,
  // supaya sinkronisasi komponen tugas berlaku (aturan: akhir final = manual).
  await prisma.nilai.deleteMany({
    where: { kelasId: kelas!.id, mahasiswaId: pesertaUji.mahasiswa.id },
  });

  // 5) Dosen menilai pengumpulan
  const nilaiSubmission = await fetch(`${BASE}/api/tugas/${tugasId}/penilaian`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({
      penilaian: [{ submissionId, nilai: 88, feedback: "Analisis tepat, simbol rapi." }],
    }),
  });
  const nilaiData = await nilaiSubmission.json();
  cek(
    "Dosen menilai pengumpulan",
    nilaiSubmission.status === 200 && nilaiData.jumlah === 1,
    `status ${nilaiSubmission.status} ${nilaiData.error ?? ""}`
  );

  // 6) Penilaian di lurang poin → ditolak (400)
  const nilaiLebih = await fetch(`${BASE}/api/tugas/${tugasId}/penilaian`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({ penilaian: [{ submissionId, nilai: 150 }] }),
  });
  cek("Nilai melebihi bobot poin → ditolak (400)", nilaiLebih.status === 400,
    `status ${nilaiLebih.status}`);

  // 7) Setelah dinilai, submit ulang → 409
  const kumpulSetelah = await fetch(`${BASE}/api/tugas/${tugasId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mhsPeserta.cookie },
    body: JSON.stringify({ teks: "Coba ubah lagi" }),
  });
  cek("Submit setelah dinilai ditolak (409)", kumpulSetelah.status === 409,
    `status ${kumpulSetelah.status}`);

  // 8) Komponen nilai "tugas" kelas tersinkron (rata-rata ternormalisasi)
  const daftarTugasKelas = await prisma.tugas.findMany({
    where: { kelasId: kelas!.id, deletedAt: null },
    select: { id: true, bobotPoin: true },
  });
  const poinPerTugas = new Map(daftarTugasKelas.map((t) => [t.id, t.bobotPoin]));
  const subNilai = await prisma.submission.findMany({
    where: { mahasiswaId: pesertaUji.mahasiswa.id, tugas: { kelasId: kelas!.id }, nilai: { not: null } },
    select: { tugasId: true, nilai: true },
  });
  const persenTugas = subNilai.map((s) =>
    Math.min(100, ((s.nilai as number) / (poinPerTugas.get(s.tugasId) ?? 100)) * 100)
  );
  const sinkronHarusnya =
    Math.round(
      (persenTugas.reduce((a, b) => a + b, 0) / Math.max(1, persenTugas.length)) * 10
    ) / 10;
  const nilaiTersinkron = await prisma.nilai.findFirst({
    where: { kelasId: kelas!.id, mahasiswaId: pesertaUji.mahasiswa.id },
    select: { tugas: true, akhir: true },
  });
  cek(
    "Nilai komponen tugas tersinkron ke tabel Nilai",
    nilaiTersinkron !== null &&
      nilaiTersinkron.tugas === sinkronHarusnya &&
      nilaiTersinkron.akhir === null,
    `tugas=${nilaiTersinkron?.tugas} (harus ${sinkronHarusnya}) akhir=${nilaiTersinkron?.akhir}`
  );

  // Setup e2e kedua: kosongkan baris Nilai agar input berikutnya tercatat
  // sebagai INPUT PERTAMA (status otomatis, tanpa validasi).
  await prisma.nilai.deleteMany({
    where: { kelasId: kelas!.id, mahasiswaId: pesertaUji.mahasiswa.id },
  });

  // 9) Input nilai batch oleh dosen — paksa nilai awal yang jelas lebih dulu
  const bobotKelas = await prisma.kelas.findUnique({
    where: { id: kelas!.id },
    select: { bobotTugas: true, bobotUTS: true, bobotUAS: true },
  });
  const harap = (t: number, u: number, a: number) =>
    Math.round(
      (t * bobotKelas!.bobotTugas + u * bobotKelas!.bobotUTS + a * bobotKelas!.bobotUAS) * 10
    ) / 10;
  const akhir1 = harap(80, 75, 70);
  const akhir2 = harap(90, 85, 80);

  const paksa = await fetch(`${BASE}/api/nilai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({
      kelasId: kelas!.id,
      alasan: "E2E — input awal baseline",
      baris: [{ mahasiswaId: pesertaUji.mahasiswa.id, tugas: 80, uts: 75, uas: 70 }],
    }),
  });
  const paksaData = await paksa.json();
  cek(
    "Dosen input nilai batch (awal)",
    paksa.status === 200 && paksaData.ok === true,
    `status ${paksa.status} ${paksaData.error ?? ""} ${JSON.stringify(paksaData).slice(0, 160)}`
  );

  const nilaiAkhir1 = await prisma.nilai.findFirst({
    where: { kelasId: kelas!.id, mahasiswaId: pesertaUji.mahasiswa.id },
  });
  cek(
    "Nilai awal diterapkan + status riwayat otomatis",
    nilaiAkhir1?.akhir !== null && Math.abs((nilaiAkhir1?.akhir ?? 0) - akhir1) < 0.01,
    `akhir=${nilaiAkhir1?.akhir} (harus ${akhir1})`
  );
  const riwayatAwal = await prisma.riwayatPerubahan.findFirst({
    where: { kelasId: kelas!.id, tipe: "nilai", nilaiId: nilaiAkhir1!.id },
    orderBy: { createdAt: "desc" },
  });
  cek("Riwayat input awal berstatus otomatis", riwayatAwal?.status === "otomatis",
    `status=${riwayatAwal?.status}`);

  // 10) Edit nilai yang sudah ada TANPA alasan → 400
  const tanpaAlasan = await fetch(`${BASE}/api/nilai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({
      kelasId: kelas!.id,
      baris: [{ mahasiswaId: pesertaUji.mahasiswa.id, tugas: 90, uts: 85, uas: 80 }],
    }),
  });
  cek("Edit nilai tanpa alasan → ditolak (400)", tanpaAlasan.status === 400,
    `status ${tanpaAlasan.status}`);

  // 11) Edit dengan alasan → diterapkan + status menunggu
  const editAlasan = await fetch(`${BASE}/api/nilai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({
      kelasId: kelas!.id,
      alasan: "E2E — koreksi jawaban analisis",
      baris: [{ mahasiswaId: pesertaUji.mahasiswa.id, tugas: 90, uts: 85, uas: 80 }],
    }),
  });
  const editData = await editAlasan.json();
  cek(
    "Edit nilai dengan alasan → diterapkan + menunggu validasi",
    editAlasan.status === 200 && editData.menunggu === 1,
    `status ${editAlasan.status} menunggu=${editData.menunggu} ${editData.error ?? ""}`
  );
  const riwayatId: string | undefined = editData.riwayatIds?.[0];

  const nilaiAkhir2 = await prisma.nilai.findFirst({
    where: { kelasId: kelas!.id, mahasiswaId: pesertaUji.mahasiswa.id },
  });
  cek(
    "Nilai edit langsung diterapkan",
    nilaiAkhir2?.akhir !== null && Math.abs((nilaiAkhir2?.akhir ?? 0) - akhir2) < 0.01,
    `akhir=${nilaiAkhir2?.akhir} (harus ${akhir2})`
  );

  // 12) Kaprodi menyetujui perubahan menunggu
  const setujui = await fetch(`${BASE}/api/validasi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: (await login("kaprodi@wahidiyah.ac.id")).cookie },
    body: JSON.stringify({ riwayatId, aksi: "setujui" }),
  });
  cek("Kaprodi menyetujui perubahan nilai", setujui.status === 200,
    `status ${setujui.status} ${(await setujui.json()).error ?? ""}`);

  // 13) Validasi kedua: tolak → nilai dikembalikan
  const edit2 = await fetch(`${BASE}/api/nilai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({
      kelasId: kelas!.id,
      alasan: "E2E — perubahan kedua yang akan ditolak",
      baris: [{ mahasiswaId: pesertaUji.mahasiswa.id, tugas: 60, uts: 60, uas: 60 }],
    }),
  });
  const edit2Data = await edit2.json();
  const kaprodi = await login("kaprodi@wahidiyah.ac.id");
  const tolak = await fetch(`${BASE}/api/validasi`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: kaprodi.cookie },
    body: JSON.stringify({ riwayatId: edit2Data.riwayatIds?.[0], aksi: "tolak" }),
  });
  const tolakData = await tolak.json();
  cek(
    "Kaprodi menolak perubahan → nilai dikembalikan",
    tolak.status === 200 && Math.abs((tolakData.nilai?.akhir ?? 0) - akhir2) < 0.01,
    `status ${tolak.status} akhir=${tolakData.nilai?.akhir} (harus ${akhir2}) ${tolakData.error ?? ""}`
  );

  // 14) Dosen mengurungkan perubahan terakhir
  const undo = await fetch(`${BASE}/api/riwayat/terbaru`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({ kelasId: kelas!.id }),
  });
  const undoData = await undo.json();
  cek(
    "Dosen urungkan perubahan terakhir",
    undo.status === 200 && typeof undoData.nilai?.akhir === "number",
    `status ${undo.status} ${undoData.error ?? ""}`
  );

  // 15) Mahasiswa tidak boleh input nilai / buat tugas
  const nilaiMahasiswa = await fetch(`${BASE}/api/nilai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m1.cookie },
    body: JSON.stringify({ kelasId: kelas!.id, baris: [] }),
  });
  cek("Mahasiswa input nilai → ditolak (403)", nilaiMahasiswa.status === 403,
    `status ${nilaiMahasiswa.status}`);

  const submitMahasiswaLain = await fetch(`${BASE}/api/tugas/${tugasId}/penilaian`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: mhsPeserta.cookie },
    body: JSON.stringify({ penilaian: [] }),
  });
  cek("Mahasiswa menilai submission → ditolak (403)",
    submitMahasiswaLain.status === 403, `status ${submitMahasiswaLain.status}`);

  console.log("\n── Alur pengumuman ──");

  // Dosen membuat pengumuman prodi → muncul di GET → dihapus kembali.
  const judulPengumuman = `E2E — Pengumuman ${Date.now()}`;
  const buatPeng = await fetch(`${BASE}/api/pengumuman`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({
      judul: judulPengumuman,
      konten: "Pengumuman uji end-to-end, akan dihapus otomatis.",
      cakupan: "prodi",
    }),
  });
  const buatPengData = await buatPeng.json();
  cek(
    "Dosen membuat pengumuman prodi",
    buatPeng.status === 201 && !!buatPengData.pengumuman.id,
    `status ${buatPeng.status} ${buatPengData.error ?? ""}`
  );
  const pengId: string | undefined = buatPengData.pengumuman?.id;

  const lisPeng = await fetch(`${BASE}/api/pengumuman`, {
    headers: { Cookie: dosen.cookie },
  });
  const lisPengData = await lisPeng.json();
  cek(
    "Pengumuman baru tampil di daftar dosen",
    lisPeng.status === 200 && lisPengData.daftar?.some((p: { id: string }) => p.id === pengId),
    `status ${lisPeng.status}`
  );

  // Cakupan kelas wajib memilih kelas → 400
  const pengTanpaKelas = await fetch(`${BASE}/api/pengumuman`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({ judul: "Tanpa kelas", konten: "harusnya ditolak", cakupan: "kelas" }),
  });
  cek("Pengumuman kelas tanpa kelas → ditolak (400)", pengTanpaKelas.status === 400,
    `status ${pengTanpaKelas.status}`);

  if (pengId) {
    const hapusPeng = await fetch(`${BASE}/api/pengumuman/${pengId}`, {
      method: "DELETE",
      headers: { Cookie: dosen.cookie },
    });
    cek("Dosen menghapus pengumuman sendiri", hapusPeng.status === 200,
      `status ${hapusPeng.status}`);
  }

  // Mahasiswa tidak boleh menerbitkan → 403
  const pengMahasiswa = await fetch(`${BASE}/api/pengumuman`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m1.cookie },
    body: JSON.stringify({ judul: "Ilegal", konten: "tidak boleh", cakupan: "prodi" }),
  });
  cek("Mahasiswa menerbitkan pengumuman → ditolak (403)", pengMahasiswa.status === 403,
    `status ${pengMahasiswa.status}`);

  console.log("\n── Manajemen akun (kaprodi sebagai operator) ──");
  const cap = String(Date.now());
  const emailDosenBaru = `e2e.dosen.${cap}@wahidiyah.ac.id`;
  const emailMhsBaru = `e2e.mhs.${cap}@wahidiyah.ac.id`;

  const buatDosen = await fetch(`${BASE}/api/manajemen/dosen`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: kaprodi.cookie },
    body: JSON.stringify({
      nama: "Dosen Uji E2E",
      nip: `E2E${cap}`,
      email: emailDosenBaru,
      password: "password123",
      bidangStudi: "Pendidikan Matematika",
    }),
  });
  const buatDosenData = await buatDosen.json();
  cek(
    "Kaprodi menambah akun dosen",
    buatDosen.status === 201 && !!buatDosenData.dosen?.id,
    `status ${buatDosen.status} ${buatDosenData.error ?? ""}`
  );
  const loginDosenBaru = await login(emailDosenBaru);
  cek(
    "Akun dosen baru dapat login",
    loginDosenBaru.role === "dosen" && !!loginDosenBaru.cookie
  );
  const dobelDosen = await fetch(`${BASE}/api/manajemen/dosen`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: kaprodi.cookie },
    body: JSON.stringify({
      nama: "Dosen Duplikat",
      nip: `E2EB${cap}`,
      email: emailDosenBaru,
      password: "password123",
    }),
  });
  cek("Email dosen ganda ditolak (409)", dobelDosen.status === 409, `status ${dobelDosen.status}`);

  const buatMhs = await fetch(`${BASE}/api/manajemen/mahasiswa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: kaprodi.cookie },
    body: JSON.stringify({
      nama: "Mahasiswa Uji E2E",
      nim: `E2EM${cap}`,
      angkatan: 2024,
      jenisKelamin: "P",
      kelasMhs: "2024-A",
      email: emailMhsBaru,
      password: "password123",
    }),
  });
  const buatMhsData = await buatMhs.json();
  cek(
    "Kaprodi menambah akun mahasiswa",
    buatMhs.status === 201 && !!buatMhsData.mahasiswa?.id,
    `status ${buatMhs.status} ${buatMhsData.error ?? ""}`
  );
  cek("Akun mahasiswa baru dapat login", (await login(emailMhsBaru)).role === "mahasiswa");

  const mhsBuatDosen = await fetch(`${BASE}/api/manajemen/dosen`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m1.cookie },
    body: JSON.stringify({
      nama: "Ilegal",
      nip: `E2EX${cap}`,
      email: `e2e.ilegal.${cap}@wahidiyah.ac.id`,
      password: "password123",
    }),
  });
  cek("Mahasiswa menambah akun ditolak (403)", mhsBuatDosen.status === 403, `status ${mhsBuatDosen.status}`);

  // Bersihkan akun uji (relasi Dosen/Mahasiswa ikut terhapus).
  await prisma.user.deleteMany({ where: { email: { in: [emailDosenBaru, emailMhsBaru] } } });

  console.log("\n── Tambah pertemuan (dosen pengampu) ──");
  const jmlPertemuanSebelum = await prisma.pertemuan.count({ where: { kelasId: kelas!.id } });
  const buatPert = await fetch(`${BASE}/api/pertemuan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
    body: JSON.stringify({ kelasId: kelas!.id, topik: "E2E pertemuan tambahan" }),
  });
  const buatPertData = await buatPert.json();
  cek(
    "Dosen menambah pertemuan pada kelasnya",
    buatPert.status === 201 && buatPertData.pertemuan?.nomor === jmlPertemuanSebelum + 1,
    `status ${buatPert.status} nomor ${buatPertData.pertemuan?.nomor}`
  );
  const pertMhs = await fetch(`${BASE}/api/pertemuan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m1.cookie },
    body: JSON.stringify({ kelasId: kelas!.id }),
  });
  cek("Mahasiswa menambah pertemuan ditolak (403)", pertMhs.status === 403, `status ${pertMhs.status}`);
  if (buatPertData.pertemuan?.id) {
    await prisma.pertemuan.delete({ where: { id: buatPertData.pertemuan.id } });
  }

  console.log("\n── Alur pengajuan KRS ──");
  const mhs1Db = await prisma.mahasiswa.findFirst({
    where: { user: { email: "mahasiswa1@wahidiyah.ac.id" } },
    select: { id: true },
  });
  const semAktif = await prisma.semester.findFirst({
    where: { isAktif: true },
    select: { id: true },
  });
  // Buat dua kelas sementara khusus uji agar mahasiswa1 pasti belum terdaftar
  // (data seed mendaftarkan mahasiswa1 ke seluruh kelas aktif).
  await prisma.kelas.deleteMany({
    where: { semesterId: semAktif!.id, kodeKelas: { in: ["E2E", "E2F"] } },
  });
  const mkSementara = await prisma.mataKuliah.findFirst({ select: { id: true } });
  const kelasUjiA = await prisma.kelas.create({
    data: { mkId: mkSementara!.id, semesterId: semAktif!.id, dosenId: dosenDb!.id, kodeKelas: "E2E" },
    select: { id: true },
  });
  const kelasUjiB = await prisma.kelas.create({
    data: { mkId: mkSementara!.id, semesterId: semAktif!.id, dosenId: dosenDb!.id, kodeKelas: "E2F" },
    select: { id: true },
  });
  const tersedia = [{ id: kelasUjiA.id }, { id: kelasUjiB.id }];
  cek("Kelas uji KRS siap", tersedia.length === 2);

  if (tersedia.length >= 1) {
    const ajukan = await fetch(`${BASE}/api/krs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: m1.cookie },
      body: JSON.stringify({ kelasIds: tersedia.map((k) => k.id) }),
    });
    const ajukanData = await ajukan.json();
    cek(
      "Mahasiswa mengajukan KRS",
      ajukan.status === 201 && ajukanData.diajukan >= 1,
      `status ${ajukan.status} ${ajukanData.error ?? ""}`
    );

    const pending = await prisma.kRS.findMany({
      where: {
        mahasiswaId: mhs1Db!.id,
        kelasId: { in: tersedia.map((k) => k.id) },
        status: "pengajuan",
      },
      select: { id: true, kelasId: true },
      orderBy: { createdAt: "asc" },
    });
    cek("Pengajuan berstatus menunggu validasi", pending.length === tersedia.length, `pending ${pending.length}`);

    const terima = await fetch(`${BASE}/api/krs/${pending[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kaprodi.cookie },
      body: JSON.stringify({ aksi: "terima" }),
    });
    cek("Kaprodi menyetujui KRS", terima.status === 200, `status ${terima.status}`);
    const setelahTerima = await prisma.kRS.findUnique({
      where: { id: pending[0].id },
      select: { status: true },
    });
    cek("KRS disetujui berstatus diambil", setelahTerima?.status === "diambil", `status ${setelahTerima?.status}`);

    if (pending[1]) {
      const validasiMhs = await fetch(`${BASE}/api/krs/${pending[1].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: m1.cookie },
        body: JSON.stringify({ aksi: "terima" }),
      });
      cek("Mahasiswa tidak boleh memvalidasi KRS (403)", validasiMhs.status === 403, `status ${validasiMhs.status}`);

      const tolak = await fetch(`${BASE}/api/krs/${pending[1].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: kaprodi.cookie },
        body: JSON.stringify({ aksi: "tolak" }),
      });
      cek("Kaprodi menolak KRS", tolak.status === 200, `status ${tolak.status}`);
      const hilang = await prisma.kRS.findUnique({ where: { id: pending[1].id } });
      cek("Pengajuan ditolak terhapus dari KRS", hilang === null);
    }

    const duplikatKrs = await fetch(`${BASE}/api/krs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: m1.cookie },
      body: JSON.stringify({ kelasIds: [pending[0].kelasId] }),
    });
    cek("Pengajuan KRS duplikat ditolak (409)", duplikatKrs.status === 409, `status ${duplikatKrs.status}`);

    // Kembalikan keadaan seed: hapus kelas & baris KRS uji.
    await prisma.kRS.deleteMany({ where: { kelasId: { in: [kelasUjiA.id, kelasUjiB.id] } } });
  }
  await prisma.kelas.deleteMany({ where: { id: { in: [kelasUjiA.id, kelasUjiB.id] } } });

  console.log("\n── Kalender akademik ──");
  const buatAgenda = await fetch(`${BASE}/api/kalender`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: kaprodi.cookie },
    body: JSON.stringify({ tanggal: new Date().toISOString(), tipe: "event", judul: "E2E Agenda" }),
  });
  const buatAgendaData = await buatAgenda.json();
  cek(
    "Kaprodi menambah agenda kalender",
    buatAgenda.status === 201 && !!buatAgendaData.agenda?.id,
    `status ${buatAgenda.status} ${buatAgendaData.error ?? ""}`
  );
  const agendaMhs = await fetch(`${BASE}/api/kalender`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: m1.cookie },
    body: JSON.stringify({ tanggal: new Date().toISOString(), tipe: "libur", judul: "Ilegal" }),
  });
  cek("Mahasiswa menambah agenda ditolak (403)", agendaMhs.status === 403, `status ${agendaMhs.status}`);
  if (buatAgendaData.agenda?.id) {
    const hapusAgenda = await fetch(`${BASE}/api/kalender/${buatAgendaData.agenda.id}`, {
      method: "DELETE",
      headers: { Cookie: kaprodi.cookie },
    });
    cek("Kaprodi menghapus agenda kalender", hapusAgenda.status === 200, `status ${hapusAgenda.status}`);
  }

  console.log("\n── Surat izin ──");
  const pertemuanSurat = await prisma.pertemuan.findFirst({
    where: { kelasId: kelas!.id },
    orderBy: { nomor: "asc" },
    select: { id: true },
  });
  if (pertemuanSurat && mhs1Db) {
    // Setup idempoten.
    await prisma.suratIzin.deleteMany({
      where: { absensi: { pertemuanId: pertemuanSurat.id, mahasiswaId: mhs1Db.id } },
    });
    await prisma.absensi.deleteMany({
      where: { pertemuanId: pertemuanSurat.id, mahasiswaId: mhs1Db.id },
    });
    const absenUji = await prisma.absensi.create({
      data: { pertemuanId: pertemuanSurat.id, mahasiswaId: mhs1Db.id, status: "alpha", metode: "manual" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.append("absensiId", absenUji.id);
    fd.append("keterangan", "Surat izin uji e2e");
    fd.append("berkas", new Blob([Buffer.from("%PDF-1.4 E2E")], { type: "application/pdf" }), "surat.pdf");
    const kirim = await fetch(`${BASE}/api/surat-izin`, {
      method: "POST",
      headers: { Cookie: m1.cookie },
      body: fd,
    });
    const kirimData = await kirim.json();
    cek(
      "Mahasiswa mengunggah surat izin",
      kirim.status === 201 && !!kirimData.surat?.id,
      `status ${kirim.status} ${kirimData.error ?? ""}`
    );

    if (kirimData.surat?.id) {
      const suratRec = await prisma.suratIzin.findUnique({
        where: { id: kirimData.surat.id },
        select: { filePath: true },
      });

      const tinjau = await fetch(`${BASE}/api/surat-izin/${kirimData.surat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
        body: JSON.stringify({ aksi: "terima" }),
      });
      cek("Dosen menyetujui surat izin", tinjau.status === 200, `status ${tinjau.status}`);

      const absenSetelah = await prisma.absensi.findUnique({
        where: { id: absenUji.id },
        select: { status: true },
      });
      cek("Absensi berubah menjadi izin", absenSetelah?.status === "izin", `status ${absenSetelah?.status}`);

      if (suratRec?.filePath) {
        try {
          await unlink(join(process.cwd(), "public", suratRec.filePath));
        } catch {
          /* berkas mungkin sudah hilang — abaikan */
        }
      }
    }

    await prisma.suratIzin.deleteMany({ where: { absensiId: absenUji.id } });
    await prisma.absensi.deleteMany({ where: { id: absenUji.id } });
  } else {
    cek("Pertemuan untuk uji surat izin tersedia", false, "pertemuan tidak ditemukan");
  }

  console.log("\n── Konsistensi kehadiran per mata kuliah ──");
  const rincian = await muatRincianKehadiran(semAktif!.id);
  const kelasSem = await prisma.kelas.findMany({
    where: { semesterId: semAktif!.id, deletedAt: null },
    select: { id: true, _count: { select: { pertemuan: true } } },
  });
  let maksPersen = 0;
  let maksInfo = "";
  for (const k of kelasSem) {
    const perMhs = rincian.get(k.id);
    if (!perMhs) continue;
    const total = k._count.pertemuan;
    for (const [mId, hit] of perMhs) {
      const persen = total > 0 ? (hit.hadir / total) * 100 : 0;
      if (persen > maksPersen) {
        maksPersen = persen;
        maksInfo = `kelas ${k.id} mhs ${mId}`;
      }
    }
  }
  cek(
    "Kehadiran per mata kuliah tidak melebihi 100%",
    maksPersen <= 100.0001,
    `maks ${maksPersen.toFixed(1)}% (${maksInfo})`
  );

  console.log("\n── Manajemen akun (tambah/hapus kaprodi & mahasiswa) ──");
  const kp = await login("kaprodi@wahidiyah.ac.id");
  const suf = Date.now().toString().slice(-6);

  // Kaprodi dapat membuat akun kaprodi lain
  const buatKp = await fetch(`${BASE}/api/manajemen/dosen`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: kp.cookie },
    body: JSON.stringify({
      role: "kaprodi",
      nama: "Kaprodi Uji E2E",
      nip: `E2E${suf}`,
      email: `e2e.kaprodi.${suf}@wahidiyah.ac.id`,
      password: "password123",
    }),
  });
  const buatKpData = await buatKp.json().catch(() => ({}));
  cek(
    "Kaprodi dapat membuat akun kaprodi baru",
    buatKp.status === 201 && !!buatKpData?.dosen?.id,
    `status ${buatKp.status}`
  );

  const emailKpBaru = `e2e.kaprodi.${suf}@wahidiyah.ac.id`;
  const loginKpBaru = await login(emailKpBaru);
  cek(
    "Akun kaprodi baru dapat login",
    loginKpBaru.role === "kaprodi" && !!loginKpBaru.cookie,
    `role ${loginKpBaru.role}`
  );

  const dosenKaprodiAsli = await prisma.dosen.findFirst({
    where: { user: { email: "kaprodi@wahidiyah.ac.id" } },
    select: { id: true },
  });

  if (dosenKaprodiAsli) {
    const patchDiri = await fetch(`${BASE}/api/manajemen/dosen/${dosenKaprodiAsli.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({ status: "nonaktif" }),
    });
    cek(
      "Kaprodi tidak dapat menonaktifkan akun sendiri",
      patchDiri.status === 400,
      `status ${patchDiri.status}`
    );

    const hapusDiri = await fetch(`${BASE}/api/manajemen/dosen/${dosenKaprodiAsli.id}`, {
      method: "DELETE",
      headers: { Cookie: kp.cookie },
    });
    cek(
      "Kaprodi tidak dapat menghapus akun sendiri",
      hapusDiri.status === 400,
      `status ${hapusDiri.status}`
    );
  }

  if (buatKpData?.dosen?.id) {
    const hapusKp = await fetch(`${BASE}/api/manajemen/dosen/${buatKpData.dosen.id}`, {
      method: "DELETE",
      headers: { Cookie: kp.cookie },
    });
    cek(
      "Kaprodi dapat menghapus akun kaprodi tanpa jejak",
      hapusKp.status === 200,
      `status ${hapusKp.status}`
    );
    const sisaKp = await prisma.user.findUnique({
      where: { email: emailKpBaru },
      select: { id: true },
    });
    cek("Akun kaprodi terhapus dari basis data", sisaKp === null);
  }

  // Mahasiswa: buat akun tanpa data lalu hapus
  const buatMhsAkun = await fetch(`${BASE}/api/manajemen/mahasiswa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: kp.cookie },
    body: JSON.stringify({
      nama: "Mahasiswa Uji E2E",
      nim: `E2M${suf}`,
      angkatan: 2024,
      jenisKelamin: "L",
      kelasMhs: "2024-A",
      email: `e2e.mhs.${suf}@wahidiyah.ac.id`,
      password: "password123",
    }),
  });
  const buatMhsAkunData = await buatMhsAkun.json().catch(() => ({}));
  cek(
    "Kaprodi dapat membuat akun mahasiswa baru",
    buatMhsAkun.status === 201 && !!buatMhsAkunData?.mahasiswa?.id,
    `status ${buatMhsAkun.status}`
  );
  if (buatMhsAkunData?.mahasiswa?.id) {
    const hapusMhs = await fetch(
      `${BASE}/api/manajemen/mahasiswa/${buatMhsAkunData.mahasiswa.id}`,
      {
        method: "DELETE",
        headers: { Cookie: kp.cookie },
      }
    );
    cek(
      "Kaprodi dapat menghapus akun mahasiswa tanpa data",
      hapusMhs.status === 200,
      `status ${hapusMhs.status}`
    );
  }

  // Mahasiswa dengan data akademik → tolak hapus (409)
  const mhsBerdata = await prisma.mahasiswa.findFirst({
    where: { krs: { some: {} } },
    select: { id: true },
  });
  if (mhsBerdata) {
    const hapusBerdata = await fetch(`${BASE}/api/manajemen/mahasiswa/${mhsBerdata.id}`, {
      method: "DELETE",
      headers: { Cookie: kp.cookie },
    });
    cek(
      "Akun mahasiswa berjejak ditolak dihapus (409)",
      hapusBerdata.status === 409,
      `status ${hapusBerdata.status}`
    );
  }

  console.log("\n── Manajemen kelas & edit profil (kaprodi) ──");

  // 1) Edit mata kuliah, lalu kembalikan ke nilai semula.
  const mkUji = await prisma.mataKuliah.findFirst({
    where: { deletedAt: null },
    select: { id: true, nama: true },
    orderBy: { kode: "asc" },
  });
  if (mkUji) {
    const editMK = await fetch(`${BASE}/api/manajemen/mk/${mkUji.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({ nama: `${mkUji.nama} (e2e)` }),
    });
    const mkSetelah = await prisma.mataKuliah.findUnique({
      where: { id: mkUji.id },
      select: { nama: true },
    });
    cek(
      "Kaprodi dapat mengedit data mata kuliah",
      editMK.status === 200 && mkSetelah?.nama === `${mkUji.nama} (e2e)`,
      `status ${editMK.status}`
    );
    await fetch(`${BASE}/api/manajemen/mk/${mkUji.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({ nama: mkUji.nama }),
    });

    const tolakEditMK = await fetch(`${BASE}/api/manajemen/mk/${mkUji.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
      body: JSON.stringify({ nama: "ditolak" }),
    });
    cek(
      "Dosen tidak dapat mengedit mata kuliah (403)",
      tolakEditMK.status === 403,
      `status ${tolakEditMK.status}`
    );
  }

  // 2) Edit profil dosen, lalu kembalikan.
  const dosenUji = await prisma.dosen.findFirst({
    where: { status: "aktif" },
    select: { id: true, bidangStudi: true },
    orderBy: { nama: "asc" },
  });
  if (dosenUji) {
    const bidangBaru = "Bidang uji e2e";
    const editDosen = await fetch(`${BASE}/api/manajemen/dosen/${dosenUji.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({ bidangStudi: bidangBaru }),
    });
    const dosenSetelah = await prisma.dosen.findUnique({
      where: { id: dosenUji.id },
      select: { bidangStudi: true },
    });
    cek(
      "Kaprodi dapat mengedit profil dosen",
      editDosen.status === 200 && dosenSetelah?.bidangStudi === bidangBaru,
      `status ${editDosen.status}`
    );
    await fetch(`${BASE}/api/manajemen/dosen/${dosenUji.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({ bidangStudi: dosenUji.bidangStudi ?? "" }),
    });
  }

  // 3) Edit profil mahasiswa, lalu kembalikan.
  const mhsUji = await prisma.mahasiswa.findFirst({
    where: { status: "aktif" },
    select: { id: true, kelasMhs: true },
    orderBy: { nim: "asc" },
  });
  if (mhsUji) {
    const kelasBaru = "E2E-UJI";
    const editMhs = await fetch(`${BASE}/api/manajemen/mahasiswa/${mhsUji.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({ kelasMhs: kelasBaru }),
    });
    const mhsSetelah = await prisma.mahasiswa.findUnique({
      where: { id: mhsUji.id },
      select: { kelasMhs: true },
    });
    cek(
      "Kaprodi dapat mengedit profil mahasiswa",
      editMhs.status === 200 && mhsSetelah?.kelasMhs === kelasBaru,
      `status ${editMhs.status}`
    );
    await fetch(`${BASE}/api/manajemen/mahasiswa/${mhsUji.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({ kelasMhs: mhsUji.kelasMhs }),
    });
  }

  // 4) Buat kelas (assign dosen) → ganti pengampu → hapus.
  const semesterUji =
    (await prisma.semester.findFirst({ where: { isAktif: true }, select: { id: true, nama: true } })) ??
    (await prisma.semester.findFirst({ select: { id: true, nama: true } }));
  const dosenPengampu = await prisma.dosen.findFirst({
    where: { status: "aktif" },
    select: { id: true },
    orderBy: { nama: "asc" },
  });
  const dosenPengampu2 = await prisma.dosen.findFirst({
    where: { status: "aktif", id: { not: dosenPengampu?.id } },
    select: { id: true },
  });
  const mkKelas =
    mkUji ??
    (await prisma.mataKuliah.findFirst({
      where: { deletedAt: null },
      select: { id: true },
    }));

  // Validasi paritas semester aktif
  if (semesterUji) {
    const mkCek = await prisma.mataKuliah.findFirst({
      where: { deletedAt: null, semesterKe: { not: null } },
      select: { semesterKe: true },
    });
    const dosenCek = await prisma.dosen.findFirst({
      where: { semesterKe: { not: null } },
      select: { semesterKe: true },
    });
    const mhsCek = await prisma.mahasiswa.findFirst({
      where: { semesterKe: { not: null } },
      select: { semesterKe: true },
    });
    const perlu = (semesterUji.nama === "Genap" ? [2, 4, 6, 8] : [1, 3, 5, 7]);
    const cekPar = (n: number | null | undefined) => typeof n === "number" && perlu.includes(n);
    cek(
      "Paritas MK mengikuti semester aktif",
      !mkCek || cekPar(mkCek.semesterKe),
      mkCek ? `semesterKe=${mkCek.semesterKe} tidak cocok` : ""
    );
    cek(
      "Paritas dosen mengikuti semester aktif",
      !dosenCek || cekPar(dosenCek.semesterKe),
      dosenCek ? `semesterKe=${dosenCek.semesterKe} tidak cocok` : ""
    );
    cek(
      "Paritas mahasiswa mengikuti semester aktif",
      !mhsCek || cekPar(mhsCek.semesterKe),
      mhsCek ? `semesterKe=${mhsCek.semesterKe} tidak cocok` : ""
    );
  }
  const kodeKelasUji = `E2E${suf}`;

  if (semesterUji && dosenPengampu && mkKelas) {
    const buatKelas = await fetch(`${BASE}/api/manajemen/kelas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: kp.cookie },
      body: JSON.stringify({
        mkId: mkKelas.id,
        semesterId: semesterUji.id,
        dosenId: dosenPengampu.id,
        kodeKelas: kodeKelasUji,
        kapasitas: 30,
        jadwal: { hari: "Senin", jamMulai: "08:00", jamSelesai: "09:40", ruang: "Ruang E2E" },
      }),
    });
    const buatKelasData = await buatKelas.json().catch(() => ({}));
    const kelasId: string | undefined = buatKelasData?.kelas?.id;
    cek(
      "Kaprodi dapat membuat kelas + assign dosen",
      buatKelas.status === 201 && !!kelasId,
      `status ${buatKelas.status}`
    );

    const tolakKelas = await fetch(`${BASE}/api/manajemen/kelas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: dosen.cookie },
      body: JSON.stringify({
        mkId: mkKelas.id,
        semesterId: semesterUji.id,
        dosenId: dosenPengampu.id,
        kodeKelas: `${kodeKelasUji}X`,
      }),
    });
    cek(
      "Dosen tidak dapat membuat kelas (403)",
      tolakKelas.status === 403,
      `status ${tolakKelas.status}`
    );

    if (kelasId) {
      const dosenTujuan = dosenPengampu2?.id ?? dosenPengampu.id;
      const ubahKelas = await fetch(`${BASE}/api/manajemen/kelas/${kelasId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: kp.cookie },
        body: JSON.stringify({ dosenId: dosenTujuan, kapasitas: 35 }),
      });
      const kelasSetelah = await prisma.kelas.findUnique({
        where: { id: kelasId },
        select: { dosenId: true, kapasitas: true },
      });
      cek(
        "Kaprodi dapat mengganti dosen pengampu kelas",
        ubahKelas.status === 200 &&
          kelasSetelah?.dosenId === dosenTujuan &&
          kelasSetelah?.kapasitas === 35,
        `status ${ubahKelas.status}`
      );

      const hapusKelas = await fetch(`${BASE}/api/manajemen/kelas/${kelasId}`, {
        method: "DELETE",
        headers: { Cookie: kp.cookie },
      });
      const kelasHilang = await prisma.kelas.findUnique({ where: { id: kelasId } });
      cek(
        "Kaprodi dapat menghapus kelas tanpa jejak (permanen)",
        hapusKelas.status === 200 && kelasHilang === null,
        `status ${hapusKelas.status}`
      );
    }
  }

  console.log("\n── Ekspor laporan akademik (Excel & PDF) ──");

  const eksporTanpaAuth = await fetch(`${BASE}/api/laporan/export?format=xlsx`);
  cek("Ekspor tanpa login → 401", eksporTanpaAuth.status === 401, `status ${eksporTanpaAuth.status}`);

  const eksporMhs = await fetch(`${BASE}/api/laporan/export?format=xlsx`, {
    headers: { Cookie: mhs.cookie },
  });
  cek("Ekspor oleh mahasiswa → 403", eksporMhs.status === 403, `status ${eksporMhs.status}`);

  const resXlsx = await fetch(`${BASE}/api/laporan/export?format=xlsx`, {
    headers: { Cookie: kp.cookie },
  });
  const bufXlsx = Buffer.from(await resXlsx.arrayBuffer());
  cek("Ekspor Excel → 200", resXlsx.status === 200, `status ${resXlsx.status}`);
  cek(
    "Excel bertipe spreadsheetml",
    (resXlsx.headers.get("content-type") ?? "").includes("spreadsheetml")
  );
  cek(
    "Excel adalah arsip XLSX valid (tanda PK)",
    bufXlsx.length > 2000 && bufXlsx[0] === 0x50 && bufXlsx[1] === 0x4b,
    `ukuran ${bufXlsx.length} byte`
  );
  cek(
    "Nama berkas Excel berekstensi .xlsx",
    (resXlsx.headers.get("content-disposition") ?? "").includes(".xlsx")
  );

  // Baca ulang berkas: pastikan benar-benar bertabel rapi, bukan CSV datar.
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bufXlsx as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const wsRekap = wb.getWorksheet("Rekap Kelas");
    const wsDetail = wb.getWorksheet("Detail Mahasiswa");
    cek("Excel memuat sheet 'Rekap Kelas' & 'Detail Mahasiswa'", !!wsRekap && !!wsDetail);

    const selHeader = wsRekap?.getRow(4).getCell(1);
    const pola = selHeader?.fill as { type?: string; fgColor?: { argb?: string } } | undefined;
    cek(
      "Header tabel Excel berwarna & tebal",
      selHeader?.font?.bold === true && pola?.type === "pattern" && !!pola.fgColor?.argb
    );
    cek("Tabel Excel memiliki autofilter", !!wsRekap?.autoFilter);
    const tampilan = (wsRekap?.views?.[0] ?? {}) as { ySplit?: number; state?: string };
    cek(
      "Header tabel dibekukan (freeze pane)",
      tampilan.state === "frozen" && tampilan.ySplit === 4,
      JSON.stringify(tampilan)
    );
  } catch (e) {
    cek("Excel dapat dibaca kembali", false, (e as Error).message);
  }

  const resPdf = await fetch(`${BASE}/api/laporan/export?format=pdf`, {
    headers: { Cookie: kp.cookie },
  });
  const bufPdf = Buffer.from(await resPdf.arrayBuffer());
  cek("Ekspor PDF → 200", resPdf.status === 200, `status ${resPdf.status}`);
  cek(
    "PDF bertipe application/pdf",
    (resPdf.headers.get("content-type") ?? "").includes("application/pdf")
  );
  cek(
    "PDF memiliki header %PDF",
    bufPdf.subarray(0, 4).toString("latin1") === "%PDF",
    bufPdf.subarray(0, 4).toString("latin1")
  );
  cek(
    "Nama berkas PDF berekstensi .pdf",
    (resPdf.headers.get("content-disposition") ?? "").includes(".pdf")
  );

  const formatSalah = await fetch(`${BASE}/api/laporan/export?format=docx`, {
    headers: { Cookie: kp.cookie },
  });
  cek("Format ekspor tak didukung → 400", formatSalah.status === 400, `status ${formatSalah.status}`);

  console.log("\n── Data seed ──");
  const mhsCount = await prisma.mahasiswa.count({ where: { status: "aktif" } });
  const nilaiCount = await prisma.nilai.count();
  const absensiCount = await prisma.absensi.count();
  cek(
    "Data seed terisi",
    mhsCount >= 40 && nilaiCount >= 100 && absensiCount >= 100,
    `mhs=${mhsCount} nilai=${nilaiCount} absensi=${absensiCount}`
  );

  console.log(`\n══ Hasil: ${lolos} lolos, ${gagal} gagal ══\n`);
  await prisma.$disconnect();
  process.exit(gagal > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E gagal berjalan:", e);
  process.exit(1);
});
