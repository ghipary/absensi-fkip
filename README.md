# SIAKAD Absensi FKIP

Sistem absensi & manajemen perkuliahan — Program Studi Pendidikan Matematika, FKIP, Universitas Wahidiyah.

**Stack:** Next.js 14 (App Router) · TypeScript · TailwindCSS · Prisma + PostgreSQL · Auth JWT + refresh rotasi · TanStack Query · Recharts · SSE real-time.

## Menjalankan (development)

```powershell
npm install
npm run db:up        # start embedded PostgreSQL (port 5433, tanpa instalasi)
npm run db:push      # sinkronkan skema
npm run db:seed      # data demo realistis
npm run dev          # http://localhost:3000
```

Produksi (Vercel): set `DATABASE_URL` (Neon/Vercel Postgres), `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` di environment variables. `vercel.json` crons untuk reminder & backup menyusul di iterasi laporan.

### Akun demo — kata sandi `password123`

| Peran | Email |
|---|---|
| Kaprodi | `kaprodi@wahidiyah.ac.id` |
| Dosen (Kalkulus I) | `muhammad.fauzi@wahidiyah.ac.id` |
| Dosen lain (7) | `siti.nurhaliza@wahidiyah.ac.id`, `budi.hartono@…`, dst. |
| Mahasiswa (40) | `mahasiswa1@wahidiyah.ac.id` … `mahasiswa40@wahidiyah.ac.id` |

> Jalankan **`npm run db:seed`** untuk memulihkan data demo penuh di atas.

## Peta route

### Halaman
| Route | Peran | Status |
|---|---|---|
| `/login` | publik | ✅ |
| `/mahasiswa` | mahasiswa | ✅ dashboard + grafik kehadiran |
| `/mahasiswa/absensi` | mahasiswa | ✅ check-in QR/kode, statistik vs 75%, riwayat, **ajukan surat izin** |
| `/mahasiswa/tugas` | mahasiswa | ✅ daftar tugas, kumpul & revisi jawaban |
| `/mahasiswa/nilai` | mahasiswa | ✅ IPK, nilai per MK, riwayat perubahan |
| `/mahasiswa/profil` | mahasiswa | ✅ KRS (aktif + riwayat), **pengajuan KRS**, profil mahasiswa |
| `/mahasiswa/jadwal` | mahasiswa | ✅ jadwal mingguan per kode/hari/jam |
| `/mahasiswa/pengumuman` | mahasiswa | ✅ daftar pengumuman prodi & kelas |
| `/dosen` | dosen/kaprodi | ✅ dashboard + jadwal + rekap kelas |
| `/dosen/absensi` | dosen/kaprodi | ✅ buka sesi (QR + kode unik), **tambah pertemuan**, daftar hadir live, absen manual, **tinjau surat izin** |
| `/dosen/tugas` | dosen/kaprodi | ✅ buat/sunting/tarik/hapus tugas, nilai submission + feedback |
| `/dosen/nilai` | dosen/kaprodi | ✅ input batch, preview akhir/grade, alasan, riwayat + undo |
| `/dosen/jadwal` | dosen/kaprodi | ✅ jadwal mengajar + jumlah mahasiswa per kelas |
| `/dosen/rekap` | dosen/kaprodi | ✅ rekap kehadiran (H/S/I/A) + nilai per mahasiswa per kelas |
| `/dosen/pengumuman` | dosen/kaprodi | ✅ terbitkan/kelola pengumuman (prodi atau kelas diampu) |
| `/dosen/profil` | dosen/kaprodi | ✅ profil dosen, kelas diampu, ringkasan mengajar |
| `/kaprodi` | kaprodi | ✅ dashboard eksekutif + 2 grafik + alert |
| `/kaprodi/validasi` | kaprodi | ✅ setujui/tolak perubahan nilai (tolak = rollback snapshot) |
| `/kaprodi/kehadiran` | kaprodi | ✅ monitoring kehadiran semua kelas + mahasiswa berisiko <75% |
| `/kaprodi/dosen` | kaprodi | ✅ monitoring dosen, beban kelas, status akun |
| `/kaprodi/laporan` | kaprodi | ✅ 3 grafik + rekap per kelas + **ekspor Excel (.xlsx) & PDF** (tabel rapi: header berwarna, border, banding, header beku, autofilter, pewarnaan <75%/grade) |
| `/kaprodi/manajemen` | kaprodi | ✅ kelola **mata kuliah & kelas (buat/assign/edit)**, **akun dosen/kaprodi & mahasiswa (tambah/edit/hapus)**, **validasi KRS**, semester aktif + pemetaan **semester ke- (paritas Ganjil/Genap)** |
| `/kaprodi/pengumuman` | kaprodi | ✅ kelola pengumuman seluruh prodi/per kelas |
| `/kaprodi/profil` | kaprodi | ✅ profil kaprodi |
| `/kalender-akademik` | semua peran | ✅ agenda semester (kaprodi: tambah/hapus) |

### API
| Endpoint | Method | Peran |
|---|---|---|
| `/api/auth/login` · `/refresh` · `/logout` | POST | publik / sesi |
| `/api/events` | GET (SSE) | login |
| `/api/notifikasi/ringkasan` | GET | login |
| `/api/absensi/sesi` | POST / DELETE | dosen, kaprodi |
| `/api/absensi/status` · `/hadir` | GET | dosen, kaprodi |
| `/api/absensi/checkin` | POST | mahasiswa |
| `/api/absensi/manual` | GET / POST | dosen, kaprodi |
| `/api/tugas` | POST | dosen, kaprodi |
| `/api/tugas/[id]` | PATCH | dosen, kaprodi |
| `/api/tugas/[id]/submit` | POST | mahasiswa |
| `/api/tugas/[id]/penilaian` | POST | dosen, kaprodi |
| `/api/nilai` | POST | dosen, kaprodi |
| `/api/nilai/undo` · `/api/riwayat/terbaru` | POST | dosen, kaprodi |
| `/api/validasi` | POST | kaprodi |
| `/api/laporan/export` | GET | kaprodi (`?format=xlsx\|pdf`) |
| `/api/pengumuman` | GET / POST | baca semua peran; tulis dosen/kaprodi |
| `/api/pengumuman/[id]` | DELETE | dosen (milik sendiri), kaprodi |
| `/api/manajemen/mk` | POST | kaprodi (tambah mata kuliah, `semesterKe` opsional sesuai paritas semester aktif) |
| `/api/manajemen/mk/[id]` | PATCH | kaprodi (edit data / aktif-nonaktif mata kuliah) |
| `/api/manajemen/kelas` | POST | kaprodi (buat kelas + assign dosen, opsional jadwal) |
| `/api/manajemen/kelas/[id]` | PATCH / DELETE | kaprodi (edit dosen/kode/kapasitas/jadwal · hapus/arsip kelas) |
| `/api/manajemen/dosen` | POST | kaprodi (tambah akun dosen **atau kaprodi**, pilih `role`) |
| `/api/manajemen/dosen/[id]` | PATCH / DELETE | kaprodi (edit profil · aktif-nonaktif · hapus akun) |
| `/api/manajemen/mahasiswa` | POST | kaprodi (tambah akun mahasiswa) |
| `/api/manajemen/mahasiswa/[id]` | PATCH / DELETE | kaprodi (edit profil · hapus akun) |
| `/api/manajemen/semester/[id]` | PATCH | kaprodi |
| `/api/pertemuan` | POST | dosen pengampu |
| `/api/krs` | POST | mahasiswa (ajukan KRS) |
| `/api/krs/[id]` | PATCH | kaprodi (terima/tolak) |
| `/api/surat-izin` | POST | mahasiswa (unggah berkas) |
| `/api/surat-izin/[id]` | PATCH | dosen pengampu (terima/tolak) |
| `/api/kalender` | POST | kaprodi |
| `/api/kalender/[id]` | DELETE | kaprodi |

## Versioning nilai

Nilai tidak pernah dihapus — hanya ditimpa, dan setiap perubahan menulis satu baris
`riwayat_perubahan` berisi snapshot JSON `{tugas, uts, uas, akhir, grade}`:

1. **Input pertama** → status `otomatis`, langsung berlaku.
2. **Edit nilai yang sudah ada** → wajib `alasan`, status `menunggu`, tetap diterapkan
   segera (dosen pengampu berwenang) lalu masuk antrean **Validasi Data** kaprodi.
3. **Setujui** → status `disetujui`. **Tolak** → nilai dikembalikan ke snapshot lama dan
   dicatat sebagai riwayat baru.
4. **Urungkan** (`/api/riwayat/terbaru` / `/api/nilai/undo`) hanya berlaku untuk perubahan
   terakhir yang belum divalidasi.
5. Penilaian tugas men-sinkron komponen `Nilai.tugas` **hanya bila `akhir` masih null**;
   nilai akhir final harus diubah lewat tabel nilai agar terekam + tervalidasi.

## Semester & paritas (semester ke-)

Program studi memakai pemetaan **semester ke- 1–8** yang dipisah menurut paritas
jenis semester (aturan di `src/lib/semester.ts`, aman untuk server & klien):

| Jenis semester | Semester ke- yang sah |
|---|---|
| **Ganjil** | 1, 3, 5, 7 |
| **Genap** | 2, 4, 6, 8 |

- Field `semesterKe` (opsional, 1–8) disimpan pada **mata kuliah**, **dosen**, dan
  **mahasiswa** (`prisma/schema.prisma`).
- Formulir tambah/edit di `/kaprodi/manajemen` menampilkan pilihan "Smt" yang otomatis
  mengikuti paritas **semester aktif** (`opsiSelectSemesterKe`); nilai di luar paritas
  ditolak server lewat `validasiSemesterKe` (400) pada `POST/PATCH /api/manajemen/mk`,
  `/api/manajemen/dosen`, dan `/api/manajemen/mahasiswa`.
- Saat membuka/mengubah kelas, `DialogKelas` **mengurutkan mata kuliah** agar yang
  paritasnya cocok dengan semester aktif muncul lebih dulu, dan **menyaring dosen**
  berdasarkan paritas yang sama.
- `prisma/seed.ts` mengisi `semesterKe` yang konsisten dengan kelas/paritas (mahasiswa
  angkatan 2023 → 5, 2024 → 3, 2025 → 1).

## Keamanan absensi

1. QR ber-signature HMAC-SHA256 + expiry (`src/lib/qr-token.ts`); sesi selalu diturunkan dari payload bertanda tangan, bukan body request.
2. Validasi DB: sesi `terbuka` + `now < expiresAt` (expired otomatis ditutup).
3. Uniqueness `(pertemuanId, mahasiswaId)` — satu absen per pertemuan (duplikat → 409).
4. Validasi KRS — hanya mahasiswa terdaftar di kelas tersebut.
5. Lokasi opsional per sesi (haversine ≤ radius, default 100 m).
6. Role dijaga middleware + guard per-handler; semua aksi CRUD & check-in ditulis ke `audit_log`.
7. Surat izin: berkas PDF/JPG/PNG maks 5 MB disimpan di `public/uploads/surat-izin/`; hanya mahasiswa pemilik absensi yang boleh mengunggah, hanya dosen pengampu yang menyetujui.

## Alur KRS & surat izin

- **KRS:** mahasiswa memilih kelas semester aktif di `/mahasiswa/profil` → baris `krs` berstatus
  `pengajuan` + notifikasi ke kaprodi. Kaprodi menyetujui (→ `diambil`) atau menolak
  (→ baris dihapus, mahasiswa dapat mengajukan ulang) dari tab **Validasi KRS** `/kaprodi/manajemen`.
- **Surat izin:** mahasiswa mengunggah surat pada baris absensi non-hadir di `/mahasiswa/absensi`;
  dosen pengampu meninjau di `/dosen/absensi` — menyetujui mengubah status absensi menjadi `izin`.

## Skema database (22 tabel)

`users, sessions, dosen, mahasiswa, tahun_akademik, semester, mata_kuliah, kelas, jadwal, krs, pertemuan, sesi_absensi, absensi, surat_izin, tugas, submission, nilai, riwayat_perubahan, pengumuman, notifikasi, audit_log, kalender_akademik` — lihat `prisma/schema.prisma`.

## Desain

Design system **Academic Precision**: token di `src/app/globals.css`, dipetakan ke Tailwind di `tailwind.config.ts`. Font **Plus Jakarta Sans** (UI) + JetBrains Mono (angka/NIM/nilai), aksen tunggal emerald `#047857`, radius 10/16/999, gradasi merek `bg-brand-gradient`, animasi masuk `animate-rise` + `stagger-rise` (dihormati `prefers-reduced-motion`), tabel padat dengan sticky header + zebra, tiga state wajib (loading/empty/error) di `src/components/ui/states.tsx`.

## Smoke test

```powershell
npm run build
npm start               # terminal 1
npx tsx scripts/e2e.ts  # terminal 2
```

> e2e dirancang untuk **data demo penuh**. Jalankan `npm run db:seed` dulu, baru `npx tsx scripts/e2e.ts`.
