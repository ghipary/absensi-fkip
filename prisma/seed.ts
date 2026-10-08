/**
 * Seed data realistis — Program Studi Pendidikan Matematika, FKIP, Universitas Wahidiyah.
 * Jalankan: npm run db:seed
 *
 * Membuat:
 * - 3 tahun akademik (2024/2025 … 2026/2027), semester Ganjil 2026/2027 aktif
 * - 12 mata kuliah Pendidikan Matematika
 * - 8 dosen + 1 kaprodi, 40 mahasiswa angkatan 2023–2025
 * - 6 kelas semester aktif + jadwal + 16 pertemuan (beberapa sudah lewat)
 * - Riwayat kehadiran 5 pertemuan pertama (campur hadir/sakit/izin/alpha)
 * - 3 tugas per kelas + submission + nilai UTS/UAS semester lalu (untuk distribusi grade)
 * - Pengumuman, notifikasi, kalender akademik, log audit
 *
 * Semua akun demo: password123
 */
import { PrismaClient, Hari, NamaSemester, StatusKehadiran } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, set, subDays } from "date-fns";

const prisma = new PrismaClient();

// Prisma enum-compatible literals
const HARI: Hari[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed * 9301 + 49297) % 233280) % arr.length];
}

// PRNG deterministik agar hasil seed konsisten
let rngState = 42;
function rng() {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
function acak<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function int(min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

async function main() {
  console.log("🌱 Mulai seed...");

  // Bersihkan (urutan menghormati FK)
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notifikasi.deleteMany(),
    prisma.pengumuman.deleteMany(),
    prisma.riwayatPerubahan.deleteMany(),
    prisma.suratIzin.deleteMany(),
    prisma.absensi.deleteMany(),
    prisma.sesiAbsensi.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.tugas.deleteMany(),
    prisma.nilai.deleteMany(),
    prisma.pertemuan.deleteMany(),
    prisma.jadwal.deleteMany(),
    prisma.kRS.deleteMany(),
    prisma.kelas.deleteMany(),
    prisma.kalenderAkademik.deleteMany(),
    prisma.semester.deleteMany(),
    prisma.tahunAkademik.deleteMany(),
    prisma.mataKuliah.deleteMany(),
    prisma.session.deleteMany(),
    prisma.mahasiswa.deleteMany(),
    prisma.dosen.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const password = await bcrypt.hash("password123", 10);

  // ── Tahun akademik & semester ──────────────────────────────────
  const ta2425 = await prisma.tahunAkademik.create({ data: { nama: "2024/2025" } });
  const ta2526 = await prisma.tahunAkademik.create({ data: { nama: "2025/2026" } });
  const ta2627 = await prisma.tahunAkademik.create({ data: { nama: "2026/2027" } });

  const sems = await Promise.all([
    prisma.semester.create({
      data: { tahunId: ta2425.id, nama: "Ganjil" as NamaSemester, tanggalMulai: new Date("2024-08-19"), tanggalSelesai: new Date("2025-01-11") },
    }),
    prisma.semester.create({
      data: { tahunId: ta2425.id, nama: "Genap" as NamaSemester, tanggalMulai: new Date("2025-01-20"), tanggalSelesai: new Date("2025-06-14") },
    }),
    prisma.semester.create({
      data: { tahunId: ta2526.id, nama: "Ganjil" as NamaSemester, tanggalMulai: new Date("2025-08-18"), tanggalSelesai: new Date("2026-01-10") },
    }),
    prisma.semester.create({
      data: { tahunId: ta2526.id, nama: "Genap" as NamaSemester, tanggalMulai: new Date("2026-01-19"), tanggalSelesai: new Date("2026-06-13") },
    }),
    prisma.semester.create({
      data: { tahunId: ta2627.id, nama: "Ganjil" as NamaSemester, tanggalMulai: new Date("2026-08-17"), tanggalSelesai: new Date("2027-01-09") },
    }),
  ]);
  const semAktif = sems[4];
  const semLalu = sems[3]; // Genap 2025/2026 (untuk nilai UAS lama)

  await prisma.semester.update({ where: { id: semAktif.id }, data: { isAktif: true } });

  // Kalender akademik
  await prisma.kalenderAkademik.createMany({
    data: [
      { semesterId: semAktif.id, tanggal: new Date("2026-08-17"), tipe: "event", judul: "Awal perkuliahan", deskripsi: "Minggu pertama semester Ganjil 2026/2027." },
      { semesterId: semAktif.id, tanggal: new Date("2026-10-19"), tipe: "libur", judul: "Cuti bersama Maulid Nabi", deskripsi: "Tidak ada perkuliahan." },
      { semesterId: semAktif.id, tanggal: new Date("2026-11-23"), tipe: "ujian", judul: "Mulai Ujian Tengah Semester", deskripsi: "UTS berlangsung 23–28 November 2026." },
      { semesterId: semAktif.id, tanggal: new Date("2027-01-04"), tipe: "ujian", judul: "Mulai Ujian Akhir Semester", deskripsi: "UAS berlangsung 4–9 Januari 2027." },
    ],
  });

  // ── Mata kuliah Pendidikan Matematika ──────────────────────────
  const mkData = [
    { kode: "PMK2101", nama: "Kalkulus I", sks: 4, kategori: "wajib" as const, deskripsi: "Limit, turunan, dan integral fungsi satu variabel." },
    { kode: "PMK2102", nama: "Kalkulus II", sks: 4, kategori: "wajib" as const, deskripsi: "Integral lanjut, deret, dan aplikasi." },
    { kode: "PMK2103", nama: "Aljabar Linear", sks: 3, kategori: "wajib" as const, deskripsi: "Matriks, ruang vektor, dan sistem linear." },
    { kode: "PMK2104", nama: "Geometri Analitik", sks: 3, kategori: "wajib" as const, deskripsi: "Koordinat kartesian dan konik." },
    { kode: "PMK3101", nama: "Statistika dan Probabilitas", sks: 3, kategori: "wajib" as const, deskripsi: "Statistik deskriptif, distribusi, dan uji hipotesis." },
    { kode: "PMK3102", nama: "Struktur Aljabar", sks: 3, kategori: "wajib" as const, deskripsi: "Grup, cincin, dan medan." },
    { kode: "PMK3103", nama: "Metode Numerik", sks: 3, kategori: "pilihan" as const, deskripsi: "Aproksimasi dan algoritma komputasi." },
    { kode: "PMD2101", nama: "Pengantar Pendidikan Matematika", sks: 2, kategori: "wajib" as const, deskripsi: "Landasan kurikulum dan pembelajaran matematika." },
    { kode: "PMD3101", nama: "Pembelajaran Aljabar", sks: 3, kategori: "wajib" as const, deskripsi: "Strategi mengajar aljabar di SMA." },
    { kode: "PMD3102", nama: "Pembelajaran Geometri", sks: 3, kategori: "wajib" as const, deskripsi: "Geometri sekolah dan bantuannya." },
    { kode: "PMD4101", nama: "Evaluasi Pembelajaran Matematika", sks: 2, kategori: "wajib" as const, deskripsi: "Asesmen formatif dan sumatif." },
    { kode: "PMD4102", nama: "Penelitian Tindakan Kelas Matematika", sks: 3, kategori: "wajib" as const, deskripsi: "PTK siklus untuk guru matematika." },
  ];
  const mks = [];
  for (const m of mkData) mks.push(await prisma.mataKuliah.create({ data: m }));

  // ── Dosen ──────────────────────────────────────────────────────
  const dosenData = [
    { nip: "197803122005011003", nama: "Drs. Ahmad Sulaiman, M.Pd.", gelar: "M.Pd.", bidang: "Pendidikan Matematika", email: "ahmad.sulaiman@wahidiyah.ac.id" },
    { nip: "198205172008121002", nama: "Siti Nurhaliza, S.Pd., M.Si.", gelar: "M.Si.", bidang: "Statistika", email: "siti.nurhaliza@wahidiyah.ac.id" },
    { nip: "198502252010011005", nama: "Budi Hartono, S.Pd., M.Pd.", gelar: "M.Pd.", bidang: "Aljabar", email: "budi.hartono@wahidiyah.ac.id" },
    { nip: "198707142012122001", nama: "Dewi Anggraini, S.Pd., M.Pd.", gelar: "M.Pd.", bidang: "Geometri", email: "dewi.anggraini@wahidiyah.ac.id" },
    { nip: "199001052015031007", nama: "Muhammad Fauzi, S.Si., M.Si.", gelar: "M.Si.", bidang: "Kalkulus", email: "muhammad.fauzi@wahidiyah.ac.id" },
    { nip: "199104222019032004", nama: "Ratna Sari, S.Pd., M.Pd.", gelar: "M.Pd.", bidang: "Metodologi", email: "ratna.sari@wahidiyah.ac.id" },
    { nip: "199211102020122003", nama: "Joko Widayat, S.Si., M.T.", gelar: "M.T.", bidang: "Metode Numerik", email: "joko.widayat@wahidiyah.ac.id" },
    { nip: "199403082021011009", nama: "Fitri Handayani, S.Pd., M.Pd.", gelar: "M.Pd.", bidang: "Evaluasi", email: "fitri.handayani@wahidiyah.ac.id" },
  ];
  // Kaprodi = akun terpisah, juga berprofil dosen
  const kaprodiDosen = await prisma.dosen.create({
    data: {
      nip: "197506152003121001",
      nama: "Prof. Dr. H. Slamet Riyadi, M.Pd.",
      gelar: "M.Pd.",
      bidangStudi: "Kepala Prodi Pendidikan Matematika",
      user: { create: { email: "kaprodi@wahidiyah.ac.id", passwordHash: password, role: "kaprodi" } },
    },
  });

  const dosens = [];
  for (const d of dosenData) {
    dosens.push(
      await prisma.dosen.create({
        data: {
          nip: d.nip,
          nama: d.nama,
          gelar: d.gelar,
          bidangStudi: d.bidang,
          user: { create: { email: d.email, passwordHash: password, role: "dosen" } },
        },
      })
    );
  }

  // ── Mahasiswa (40) ─────────────────────────────────────────────
  const namaMhs = [
    "Ahmad Rizky Pratama", "Siti Aminah", "Bambang Sutrisno", "Dwi Lestari Wulandari",
    "Eko Prasetyo", "Fitriani Rahmawati", "Gunawan Saputra", "Hesti Nur Kholifah",
    "Indra Kusuma", "Juliawati Ningsih", "Kurniawan Hadi", "Laila Mashruroh",
    "Muhammad Arif Budiman", "Nia Kurnia Sari", "Oktavianus Darmawan", "Putri Handayani",
    "Qomarudin Amin", "Ratih Ayu Permatasari", "Surya Nugroho", "Tika Amelia",
    "Umar Syarif", "Vina Marlina", "Wahyu Setiawan", "Xiomi Rahmawati",
    "Yudi Hermawan", "Zahrotul Fadhilah", "Andi Saputra Ramadhan", "Belinda Ayu Lestari",
    "Candra Wijaya", "Dian Purnamasari", "Erwin Setiabudi", "Fajar Nugroho Aji",
    "Gita Savitri Devi", "Hendro Prasetyo", "Ika Wulandari Sari", "Jefri Ardiansyah",
    "Kiki Amelia Putri", "Lukman Hakim Saifuddin", "Mega Safitri", "Nanda Ardiansyah Putra",
  ];

  const mahasiswas = [];
  for (let i = 0; i < 40; i++) {
    const angkatan = i < 18 ? 2023 : i < 30 ? 2024 : 2025;
    const nim = `${String(angkatan).slice(2)}1010${String(i + 1).padStart(4, "0")}`;
    mahasiswas.push(
      await prisma.mahasiswa.create({
        data: {
          nim,
          nama: namaMhs[i],
          angkatan,
          jenisKelamin: i % 2 === 0 ? "L" : "P",
          kelasMhs: `${angkatan}-${i % 2 === 0 ? "A" : "B"}`,
          telepon: `0812${String(30000000 + i * 137).slice(0, 8)}`,
          user: {
            create: {
              email: `mahasiswa${i + 1}@wahidiyah.ac.id`,
              passwordHash: password,
              role: "mahasiswa",
            },
          },
        },
      })
    );
  }

  // ── Kelas semester aktif (6 kelas, angkatan 2023 semester 5) ────
  const kelasDefs = [
    { mk: 0, dosen: 4, kode: "A", hari: "Senin", jam: ["08:00", "10:30"], ruang: "R-201" },      // Kalkulus I
    { mk: 2, dosen: 2, kode: "A", hari: "Selasa", jam: ["08:00", "09:40"], ruang: "R-203" },      // Aljabar Linear
    { mk: 3, dosen: 3, kode: "A", hari: "Rabu", jam: ["10:00", "11:40"], ruang: "R-205" },        // Geometri Analitik
    { mk: 4, dosen: 1, kode: "A", hari: "Kamis", jam: ["08:00", "09:40"], ruang: "R-102" },       // Statistika
    { mk: 8, dosen: 5, kode: "A", hari: "Jumat", jam: ["10:00", "11:40"], ruang: "R-301" },       // Pembelajaran Aljabar
    { mk: 11, dosen: 7, kode: "A", hari: "Sabtu", jam: ["08:00", "09:40"], ruang: "R-302" },      // PTK Matematika
  ];

  const kelasList = [];
  for (const kd of kelasDefs) {
    const jadwalHari = HARI.includes(kd.hari as Hari) ? (kd.hari as Hari) : "Senin";
    const kelas = await prisma.kelas.create({
      data: {
        mkId: mks[kd.mk].id,
        semesterId: semAktif.id,
        dosenId: dosens[kd.dosen].id,
        kodeKelas: kd.kode,
        jadwal: {
          create: { hari: jadwalHari, jamMulai: kd.jam[0], jamSelesai: kd.jam[1], ruang: kd.ruang },
        },
      },
      include: { jadwal: true },
    });
    kelasList.push(kelas);
  }

  // KRS: semua mahasiswa angkatan 2023 ikut 6 kelas
  const mhs2023 = mahasiswas.filter((m) => m.angkatan === 2023);
  for (const kelas of kelasList) {
    await prisma.kRS.createMany({
      data: mhs2023.map((m) => ({ kelasId: kelas.id, mahasiswaId: m.id })),
      skipDuplicates: true,
    });
  }
  // Mahasiswa angkatan 2024 mengambil 2 kelas
  const mhs2024 = mahasiswas.filter((m) => m.angkatan === 2024);
  for (const kelas of kelasList.slice(0, 2)) {
    await prisma.kRS.createMany({
      data: mhs2024.map((m) => ({ kelasId: kelas.id, mahasiswaId: m.id })),
      skipDuplicates: true,
    });
  }

  // ── 16 pertemuan per kelas (mulai 17 Agu 2026, mingguan) ──────
  // "Hari ini" = 9 Okt 2026 (Jumat) → pertemuan 1–7 sudah lewat di beberapa kelas
  const hariIndex: Record<string, number> = {
    Minggu: 0, Senin: 1, Selasa: 2, Rabu: 3, Kamis: 4, Jumat: 5, Sabtu: 6,
  };
  const semuaPertemuan: { id: string; kelasId: string; nomor: number; tanggal: Date }[] = [];

  for (const kelas of kelasList) {
    const jadwal = kelas.jadwal[0];
    const idxHari = hariIndex[jadwal.hari] ?? 1;
    // Cari Senin minggu pertama (17 Agu 2026 = Senin), lalu geser ke hari jadwal
    const seninAwal = new Date("2026-08-17");
    let tanggal0 = addDays(seninAwal, (idxHari - 1 + 7) % 7);

    const topikPerMK: Record<string, string[]> = {
      [mks[0].id]: ["Konsep limit", "Teorema limit", "Turunan fungsi", "Rantai aturan", "Diferensiasi implisit", "Maksimum-minimum", "Integral tak tentu", "Substitusi trigonometri", "Integrasi parsial", "Integral tentu", "Aplikasi luas", "Riemann sum", "Deret pangkat", "Deret Taylor", "Aplikasi integral", "Review dan latihan soal"],
      [mks[2].id]: ["Sistem linear", "Matriks dan determinan", "Operasi baris", "Ruang vektor", "Basis dan dimensi", "Transformasi linier", "Nilai eigen", "Diagonalisasi", "Ruang kolom dan baris", "Proyeksi ortogonal", "Norm dan jarak", "Ortogonalisasi Gram-Schmidt", "Aplikasi matriks", "Model linear", "Studi kasus", "Review dan UTS"],
      [mks[3].id]: ["Koordinat kartesian", "Garis dan lingkaran", "Konik parabola", "Elips dan hiperbola", "Persamaan parametrik", "Vektor posisi", "Jarak dan sudut", "Rotasi koordinat", "Koordinat polar", "Kurva parametrik", "Tangen dan normal", "Aplikasi konik", "Persamaan implicit", "Geometri analitik 3D", "Latihan soal", "Review"],
      [mks[4].id]: ["Statistik deskriptif", "Diagram distribusi", "Peluang dasar", "Teorema Bayes", "Distribusi diskret", "Distribusi kontinu", "Distribusi normal", "Pengambilan sampel", "Estimasi titik", "Interval kepercayaan", "Uji hipotesis satu sampel", "Uji dua sampel", "Korelasi", "Regresi linier", "Chi-kuadrat", "Aplikasi studi kasus"],
      [mks[8].id]: ["Aljabar sekolah dasar", "Pemecahan masalah", "Pola dan urutan", "Pendekatan kontekstual", "Tugas kolektif", "Media pembelajaran", "Konsep variabel", "Aljabar linier", "Fungsi dan grafik", "Sistem persamaan", "Pembelajaran berdiferensiasi", "Soal cerita", "Asesmen diagnostik", "Desain RPP aljabar", "Presentasi", "Refleksi"],
      [mks[11].id]: ["Konsep PTK", "Rumusan masalah", "Perencanaan siklus", "Instrumen pengumpulan data", "Observasi kelas", "Analisis data kualitatif", "Siklus 1 - pelaksanaan", "Siklus 1 - refleksi", "Siklus 2 - pelaksanaan", "Siklus 2 - refleksi", "Pelaporan hasil", "Etika penelitian", "Publikasi hasil", "Presentasi proposal", "Diskusi kasus", "Evaluasi akhir"],
    };
    const topik = topikPerMK[kelas.mkId] ?? topikPerMK[mks[0].id];

    for (let n = 1; n <= 16; n++) {
      const tgl = addDays(tanggal0, (n - 1) * 7);
      if (tgl > new Date("2026-12-20")) break; // batas semester
      const p = await prisma.pertemuan.create({
        data: {
          kelasId: kelas.id,
          nomor: n,
          tanggal: tgl,
          topik: topik[n - 1] ?? `Pertemuan ke-${n}`,
        },
      });
      semuaPertemuan.push({ id: p.id, kelasId: kelas.id, nomor: n, tanggal: tgl });
    }
  }

  // ── Riwayat absensi: pertemuan yang sudah lewat (tanggal < hari ini) ──
  const hariIni = new Date("2026-10-09");
  const pertemuanLewat = semuaPertemuan.filter((p) => p.tanggal < hariIni);
  const statuses: StatusKehadiran[] = ["hadir", "hadir", "hadir", "hadir", "hadir", "hadir", "sakit", "izin", "alpha"];

  for (const p of pertemuanLewat) {
    const kelas = kelasList.find((k) => k.id === p.kelasId)!;
    const jadwal = kelas.jadwal[0];
    const jamMulai = jadwal.jamMulai;
    const dibuka = set(new Date(p.tanggal), {
      hours: Number(jamMulai.split(":")[0]),
      minutes: Number(jamMulai.split(":")[1]),
    });
    const dosen = dosens.find((d) => d.id === kelas.dosenId)!;

    // 85% mahasiswa punya catatan absen (sisanya alpha tanpa check-in = tidak dibuat)
    const peserta = await prisma.kRS.findMany({
      where: { kelasId: p.kelasId, status: "diambil" },
      select: { mahasiswaId: true },
    });

    const sesi = await prisma.sesiAbsensi.create({
      data: {
        pertemuanId: p.id,
        kelasId: p.kelasId,
        dosenId: dosen.id,
        metode: "qr",
        token: `seed-token-${p.id}`,
        kodeUnik: String(int(100000, 999999)),
        expiresAt: new Date(dibuka.getTime() + 10 * 60_000),
        status: "ditutup",
        openedAt: dibuka,
        closedAt: new Date(dibuka.getTime() + 45 * 60_000),
      },
    });

    for (const krs of peserta) {
      //8% tidak tercatat sama sekali (alpha tanpa absen)
      if (rng() < 0.08) continue;
      const status = acak(statuses);
      const menit = status === "hadir" ? int(0, 9) : int(0, 30);
      await prisma.absensi.create({
        data: {
          sesiId: sesi.id,
          pertemuanId: p.id,
          mahasiswaId: krs.mahasiswaId,
          status,
          metode: status === "hadir" ? (rng() < 0.7 ? "qr" : "kode") : "manual",
          checkInAt: new Date(dibuka.getTime() + menit * 60_000),
          catatan: status !== "hadir" ? "Dicatat dosen saat kelas berlangsung" : null,
        },
      });
    }
  }

  // ── Tugas semester ini + submission ────────────────────────────
  const tugasDefs: { kelasIdx: number; judul: string; deskripsi: string; deadlineHari: number }[] = [
    { kelasIdx: 0, judul: "Latihan Turunan Fungsi", deskripsi: "Kerjakan soal nomor 1–20 pada buku Larson bab 3. Kumpulkan dalam berkas PDF berisi langkah penyelesaian lengkap, bukan hanya jawaban akhir.", deadlineHari: 5 },
    { kelasIdx: 0, judul: "Analisis Grafik Fungsi Kontinu", deskripsi: "Pilih 3 fungsi polinomial orde 4, analisis asimptot, titik kritis, dan luas daerah di bawah kurva. Sertakan plot grafik dari software hitung.", deadlineHari: 12 },
    { kelasIdx: 1, judul: "Esai Penerapan Matriks", deskripsi: "Tuliskan makalah 4 halaman tentang penerapan matriks dalam ekonomi atau jaringan. Format Times New Roman 12, spasi 1.5, sitasi APA.", deadlineHari: 8 },
    { kelasIdx: 2, judul: "Konstruksi Konik pada Bidang Datar", deskripsi: "Buat poster A2 berisi konstruksi parabola, elips, dan hiperbola beserta bukti geometris fokus-directris. Foto konstruksi dilampirkan.", deadlineHari: 10 },
    { kelasIdx: 3, judul: "Laporan Praktikum Statistik Deskriptif", deskripsi: "Kumpulkan data 30 observasi nyata dari lingkungan kampus, hitung ukuran tendensi sentral dan penyebaran, sajikan dalam histogram.", deadlineHari: 6 },
    { kelasIdx: 4, judul: "Desain RPP Pembelajaran Aljabar", deskripsi: "Susun RPP satu pertemuan (2 JP) topik persamaan linear dua variabel dengan pendekatan PBL, lengkap dengan rubrik penilaiannya.", deadlineHari: 14 },
    { kelasIdx: 5, judul: "Proposal Mini PTK Siklus I", deskripsi: "Rumuskan masalah nyata di kelas, lakukan studi pendahuluan 2 minggu, dan susun proposal PTK siklus 1 sepanjang 8 halaman.", deadlineHari: 18 },
  ];

  for (const td of tugasDefs) {
    const kelas = kelasList[td.kelasIdx];
    const dosen = dosens.find((d) => d.id === kelas.dosenId)!;
    const deadline = addDays(hariIni, td.deadlineHari);
    const tugas = await prisma.tugas.create({
      data: {
        kelasId: kelas.id,
        judul: td.judul,
        deskripsi: td.deskripsi,
        deadlineAt: set(deadline, { hours: 23, minutes: 59 }),
        bobotPoin: 100,
        createdById: dosen.id,
        publishedAt: subDays(hariIni, 7),
      },
    });

    // 60% sudah mengumpul
    const peserta = await prisma.kRS.findMany({
      where: { kelasId: kelas.id, status: "diambil" },
      select: { mahasiswaId: true },
    });
    for (const krs of peserta) {
      if (rng() > 0.6) continue;
      const terlambat = rng() < 0.1;
      const dinilai = td.deadlineHari < 8 && rng() < 0.7;
      await prisma.submission.create({
        data: {
          tugasId: tugas.id,
          mahasiswaId: krs.mahasiswaId,
          teks: "Berikut saya lampirkan penyelesaian sesuai instruksi pada deskripsi tugas.",
          linkUrl: `https://drive.google.com/file/d/seed-${tugas.id.slice(-6)}-${krs.mahasiswaId.slice(-4)}/view`,
          submittedAt: terlambat
            ? new Date(set(deadline, { hours: 23, minutes: 59 }).getTime() + 3 * 3600_000)
            : subDays(deadline, int(1, 5)),
          isTerlambat: terlambat,
          nilai: dinilai ? int(70, 95) : null,
          feedback: dinilai
            ? acak([
                "Langkah penyelesaian sudah sistematis. Perhatikan penulisan notasi turunan pada soal nomor 7.",
                "Analisis grafik bagus, lampiran plot sudah jelas. Revisi kecil pada referensi sitasi.",
                "Laporan rapi dan lengkap. Paragraf pembuka bisa diperpendek.",
              ])
            : null,
          dinilaiOlehId: dinilai ? dosen.id : null,
          dinilaiPada: dinilai ? subDays(deadline, 1) : null,
        },
      });
    }
  }

  // ── Nilai semester lalu (Genap 2025/2026) untuk distribusi & IPK ──
  const mkLama = [mks[1], mks[5], mks[6], mks[9], mks[10]];
  const dosenLama = [dosens[0], dosens[2], dosens[6], dosens[3], dosens[7]];
  const kelasLamaList = [];
  for (let i = 0; i < mkLama.length; i++) {
    const k = await prisma.kelas.create({
      data: {
        mkId: mkLama[i].id,
        semesterId: semLalu.id,
        dosenId: dosenLama[i].id,
        kodeKelas: "A",
      },
    });
    kelasLamaList.push(k);
    // 16 pertemuan lama (semua sudah lewat) → untuk data kehadiran historis
    for (let n = 1; n <= 16; n++) {
      await prisma.pertemuan.create({
        data: {
          kelasId: k.id,
          nomor: n,
          tanggal: addDays(new Date("2026-01-19"), (n - 1) * 7),
        },
      });
    }
    // KRS mahasiswa 2023
    await prisma.kRS.createMany({
      data: mhs2023.map((m) => ({ kelasId: k.id, mahasiswaId: m.id })),
      skipDuplicates: true,
    });
    // Nilai akhir: sebaran realistis
    const nilaiPerGrade: Record<string, number> = { A: 0.3, B: 0.35, C: 0.22, D: 0.08, E: 0.05 };
    for (const m of mhs2023) {
      const r = rng();
      let akhir: number;
      if (r < nilaiPerGrade.A) akhir = int(80, 96);
      else if (r < nilaiPerGrade.A + nilaiPerGrade.B) akhir = int(70, 79);
      else if (r < 0.87) akhir = int(60, 69);
      else if (r < 0.95) akhir = int(50, 59);
      else akhir = int(35, 49);
      const grade = akhir >= 80 ? "A" : akhir >= 70 ? "B" : akhir >= 60 ? "C" : akhir >= 50 ? "D" : "E";
      await prisma.nilai.create({
        data: {
          kelasId: k.id,
          mahasiswaId: m.id,
          tugas: Math.min(100, akhir + int(-5, 8)),
          uts: Math.min(100, akhir + int(-7, 7)),
          uas: Math.min(100, akhir + int(-5, 5)),
          akhir,
          grade: grade as "A" | "B" | "C" | "D" | "E",
          updatedById: dosenLama[i].userId,
        },
      });
    }
  }

  // Nilai semester berjalan (baru UTS belum UAS → akhir null)
  for (const kelas of kelasList) {
    const peserta = await prisma.kRS.findMany({
      where: { kelasId: kelas.id, status: "diambil" },
      select: { mahasiswaId: true },
    });
    for (const krs of peserta) {
      if (rng() < 0.85) {
        await prisma.nilai.create({
          data: {
            kelasId: kelas.id,
            mahasiswaId: krs.mahasiswaId,
            tugas: int(70, 98),
            uts: int(55, 95),
            uas: null,
            akhir: null,
            grade: null,
            updatedById: kelas.dosenId === dosens[0].id ? dosens[0].userId : null,
          },
        });
      }
    }
  }

  // ── Pengumuman ─────────────────────────────────────────────────
  const kaprodiUserId = kaprodiDosen.userId;
  await prisma.pengumuman.createMany({
    data: [
      {
        judul: "KRS Semester Ganjil 2026/2027 Dibuka",
        konten: "Pengisian KRS berlangsung 17–22 Agustus 2026 melalui SIAKAD. Pastikan Anda berkonsultasi dengan dosen wali sebelum mengambil lebih dari 24 SKS. KRS yang sudah disetujui tidak dapat diubah setelah batas waktu berakhir.",
        cakupan: "prodi",
        semesterId: semAktif.id,
        createdById: kaprodiUserId,
      },
      {
        judul: "Jadwal Ujian Tengah Semester 2026/2027",
        konten: "UTS berlangsung 23–28 November 2026. Kartu ujian dapat diunduh mulai 16 November. Mahasiswa dengan kehadiran di bawah 75% berhak mengikuti UTS dengan surat izin dari kaprodi.",
        cakupan: "prodi",
        semesterId: semAktif.id,
        createdById: kaprodiUserId,
      },
      {
        judul: "Penyuluhan Plagiarisme dalam Penulisan Karya Ilmiah",
        konten: "Bimbingan penulisan bebas plagiarisme untuk mahasiswa semester 7 dilaksanakan Sabtu, 24 Oktober 2026 pukul 09.00 di Aula FKIP. Kehadiran wajib bagi peserta yang sedang menyusun skripsi.",
        cakupan: "prodi",
        semesterId: semAktif.id,
        createdById: kaprodiUserId,
      },
      {
        judul: "Tugas Analisis Grafik Ditambah Waktu",
        konten: "Berkas analisis grafik fungsi kontinu diperpanjang deadline-nya menjadi 12 hari kerja dari pengumuman ini. Kumpulkan melalui tautan yang sama, format PDF.",
        cakupan: "kelas",
        kelasId: kelasList[0].id,
        semesterId: semAktif.id,
        createdById: dosens[4].userId,
      },
    ],
  });

  // ── Notifikasi contoh ──────────────────────────────────────────
  const mhs1 = mahasiswas[0];
  await prisma.notifikasi.createMany({
    data: [
      { userId: mhs1.userId, tipe: "tugas", judul: "Tugas baru: Latihan Turunan Fungsi", pesan: "Kalkulus I · deadline 5 hari lagi.", link: "/mahasiswa/tugas" },
      { userId: mhs1.userId, tipe: "nilai", judul: "Nilai UTS Aljabar Linear sudah keluar", pesan: "Periksa tab Nilai untuk melihat rinciannya.", link: "/mahasiswa/nilai" },
      { userId: mhs1.userId, tipe: "absensi", judul: "Absensi pertemuan 8 dibuka", pesan: "Geometri Analitik · Sabtu 08.00 WIB.", link: "/mahasiswa/absensi" },
      { userId: dosens[4].userId, tipe: "sistem", judul: "3 submission menunggu penilaian", pesan: "Kalkulus I · Latihan Turunan Fungsi.", link: "/dosen/tugas" },
    ],
  });

  // ── Audit log contoh ───────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { userId: kaprodiUserId, aksi: "update", entityType: "kelas", newValue: { action: "assign dosen", dosen: dosens[4].nama, mataKuliah: mks[0].nama } },
      { userId: dosens[4].userId, aksi: "create", entityType: "tugas", newValue: { judul: "Latihan Turunan Fungsi" } },
      { userId: kaprodiUserId, aksi: "approve", entityType: "nilai", oldValue: { akhir: 78 }, newValue: { akhir: 82, alasan: "Koreksi perhitungan bobot UAS." } },
    ],
  });

  console.log("✅ Seed selesai.");
  console.log("   Akun demo (password123):");
  console.log("   - kaprodi@wahidiyah.ac.id");
  console.log("   - dosen (8): muhammad.fauzi@wahidiyah.ac.id, siti.nurhaliza@wahidiyah.ac.id, ...");
  console.log("   - mahasiswa (40): mahasiswa1@wahidiyah.ac.id … mahasiswa40@wahidiyah.ac.id");
  console.log(`   Kelas aktif: ${kelasList.length} · Pertemuan lewat: ${pertemuanLewat.length} · Nilai lama: ${mhs2023.length * mkLama.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
