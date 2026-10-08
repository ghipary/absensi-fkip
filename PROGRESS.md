# PROGRESS — Absensi & Manajemen Perkuliahan (Prodi Pendidikan Matematika, FKIP Univ. Wahidiyah)

## 1. Terakhir ngoding

**Jumat, 9 Oktober 2026 — ±05:00 WIB** (jam sistem komputer).

Status saat berhenti: **hijau semua** — `npx tsc --noEmit` bersih, `npm run build`
sukses (**59 rute**), `npx tsx scripts/e2e.ts` **99/99 lolos**.

**Ringkasan lanjutan sesi (9 Okt):**
1. `/mahasiswa/profil` (awal sesi) → terverifikasi (**29 rute, 46/46**).
2. Batch 3 **tuntas semua 10 rute** → **41 rute, 61/61** (lihat Bagian 2).
3. Poles Batch 4: **SSE per-user** + **notifCount asli** dari DB (lihat Bagian 2).
4. **Batch 5 tuntas** (lihat Bagian 2): fix kehadiran >100% per MK, profil kaprodi,
   tambah akun mahasiswa/dosen oleh kaprodi, tambah pertemuan oleh dosen, alur
   pengajuan KRS, surat izin, dan kalender akademik → **49 rute, 89/89**.
5. **Batch 6 tuntas** (lihat Bagian 2): fix akar error `/kaprodi/profil` (kode galat
   `872332822`), halaman profil dosen, buat akun kaprodi, hapus akun semua peran +
   pengaman lockout, dan poles UI (animasi + gradasi) → **59 rute, 99/99**.
6. **Poles keterbacaan UI** (9 Okt): skala tipografi dinaikkan (+1px, line-height
   lebih lapang), kontras `fg-subtle` dinaikkan (terang & gelap), teks gradien pada
   merek sidebar diganti warna solid, latar pola titik halus bernuansa akademik,
   logo sidebar beranimasi lembut, dan target sentuh item navigasi diperbesar.
   → build **59 rute**, e2e **99/99** tetap hijau.
7. **Tema pendidikan ekspresif** (9 Okt): font utama diganti **Plus Jakarta Sans**
   (sekalian memperbaiki wiring `--font-sans` yang sebelumnya jatuh ke font sistem),
   komponen **`DashboardHero`** untuk dashboard 3 peran (label peran, sambutan,
   ikon gradien beranimasi, watermark akademik), animasi masuk **bertahap**
   (`stagger-rise`) pada kartu statistik. → build **59 rute**, e2e **99/99**.
8. **Perbaikan ketahanan e2e**: alur tugas sebelumnya memakai peserta KRS dengan NIM
   terkecil, yang bisa jadi akun non-seed (mis. `alghifary@gmail.com`) sehingga login
   `password123` gagal → 403. Kini e2e memilih peserta berakun seed (`@wahidiyah.ac.id`).
   → e2e **99/99** konsisten meski ada akun buatan pengguna.
9. **Batch 7 — Manajemen kelas & edit data** (9 Okt): kaprodi kini dapat
   **membuat/mengubah/menghapus kelas** (mengaitkan mata kuliah + semester + dosen
   pengampu, plus jadwal) lewat tab **Kelas** baru, serta **mengedit data**
   mata kuliah, profil dosen/kaprodi, dan profil mahasiswa (fitur perbaikan bila
   ada kekeliruan data). API baru: `POST/PATCH/DELETE /api/manajemen/kelas[/id]`;
   PATCH MK/dosen/mahasiswa diperluas untuk field profil dengan pengaman
   keunikan. Sekaligus **memperbaiki bug lama** pada PATCH MK: body tanpa `aktif`
   dulu otomatis men-soft-delete mata kuliah; kini hanya bila `aktif` dikirim.
   → e2e **107/107** (8 asersi baru).

---

## 2. Yang sudah selesai

### Batch 1 — Fondasi (selesai)
- **Stack:** Next.js 14 App Router + TypeScript + Tailwind 3.4 + Prisma/PostgreSQL, deploy target Vercel.
- **Skema DB:** 22 tabel (lihat `prisma/schema.prisma`), sudah `db push` + Prisma Client v6.19.3.
- **Seed** (`prisma/seed.ts`): 12 mata kuliah, 9 dosen (termasuk kaprodi), 40 mahasiswa,
  6 kelas aktif, 46 pertemuan lewat, 90+ nilai, 3 tugas/kelas + submission.
- **Auth:** JWT custom (`jose`) — access 15 mnt cookie `absensi_access`, refresh opaque 7 hari
  (di-hash SHA-256 di tabel `sessions`) cookie `absensi_refresh` path `/api/auth`.
- **RBAC:** `src/lib/rbac.ts` (MENU + ROLE_ROUTE), middleware guard, guard per-handler di API.
- **Lib:** `utils.ts`, `prisma.ts`, `auth.ts`, `rbac.ts`, `qr-token.ts` (HMAC + expiry), `grade.ts`,
  `audit.ts`, `sse-bus.ts`.
- **Komponen UI lengkap** (gaya shadcn tulis tangan) di `src/components/ui/` + `shared/` + `layout/`.
- **Halaman:** login, dashboard ketiga peran, `/mahasiswa/absensi` (scan QR, kode unik, geolokasi),
  `/dosen/absensi` (buka sesi, QR canvas, countdown, daftar hadir live, absen manual).
- **API absensi:** `/api/absensi/sesi|checkin|status|hadir|manual` + `/api/events` (SSE).
- `README.md` (cara jalan, peta route/API, catatan keamanan).

### Batch 2 — Nilai + Tugas (selesai, 9 Okt 01:25)
**API baru (8 rute):**

| Endpoint | Peran | Fungsi |
|---|---|---|
| `POST /api/tugas` | dosen, kaprodi | buat + publikasi + notifikasi peserta KRS |
| `PATCH /api/tugas/[id]` | dosen, kaprodi | sunting / `terbit` / `tarik` / `hapus` (soft delete; ditolak bila sudah ada nilai) |
| `POST /api/tugas/[id]/submit` | mahasiswa | upsert jawaban (`teks`/`linkUrl`), flag `isTerlambat`, **409** bila sudah dinilai |
| `POST /api/tugas/[id]/penilaian` | dosen, kaprodi | nilai 0–`bobotPoin` + feedback, sinkron komponen `Nilai.tugas` |
| `POST /api/nilai` | dosen, kaprodi | input batch + kewajiban `alasan` + tulis riwayat snapshot |
| `POST /api/nilai/undo` | dosen, kaprodi | urungkan **1 riwayat tertentu** |
| `POST /api/riwayat/terbaru` | dosen, kaprodi | urungkan perubahan **terakhir** di sebuah kelas |
| `POST /api/validasi` | kaprodi | `setujui` / `tolak` (tolak = rollback ke snapshot lama) |

**Helper baru:** `src/lib/notifikasi.ts` → `kirimNotifikasi()` (createMany `notifikasi` + broadcast SSE)
dan `userIdPesertaKelas()`.

**Halaman baru (5):**
- `/dosen/tugas` + `panel-tugas.tsx` — pilih kelas, tabel tugas, dialog buat/sunting,
  aksi terbit/tarik/hapus (ada dialog konfirmasi), dialog pengumpulan + penilaian massal.
- `/dosen/nilai` + `panel-nilai.tsx` — input 3 komponen per baris, **preview akhir/grade live**,
  field alasan, tombol simpan & "urungkan terakhir", sidebar riwayat 12 entri + badge status.
- `/mahasiswa/tugas` + `tabel-tugas.tsx` — 4 StatCard, tabel status, dialog kumpulkan/revisi.
- `/mahasiswa/nilai` (server) — IPK sementara, tabel nilai per MK, riwayat milik sendiri (read-only).
- `/kaprodi/validasi` + `panel-validasi.tsx` — antrean `menunggu`, diff sebelum→sesudah,
  tombol Setujui/Tolak (+ dialog konfirmasi), panel riwayat terkini & aturan validasi.

**State global wajib:** `src/app/(dashboard)/loading.tsx` (skeleton judul + 4 kartu + tabel)
dan `src/app/(dashboard)/error.tsx` (pesan Indonesia + kode galat + tombol "Coba lagi").

**Aturan versioning nilai yang ditegakkan (sudah diuji e2e):**
1. Input pertama (baris `Nilai` belum ada) → riwayat `otomatis`, langsung berlaku.
2. Edit nilai yang sudah ada → **wajib `alasan`** (tanpa alasan → 400), status `menunggu`,
   nilai tetap diterapkan segera, lalu masuk antrean **Validasi Data** kaprodi.
3. `setujui` → `disetujui`; `tolak` → nilai dikembalikan ke `nilaiLama` dan dicatat sebagai
   riwayat baru. **Nilai tidak pernah dihapus**, hanya ditimpa.
4. Undo hanya untuk perubahan **terakhir** yang belum `disetujui`/`ditolak`.
5. Penilaian tugas men-sinkron `Nilai.tugas` (rata-rata ternormalisasi 0–100) **hanya bila
   `akhir == null`**; nilai akhir final wajib diubah lewat tabel nilai agar tervalidasi.
6. Batasan RBAC teruji: mahasiswa bukan peserta → submit 403; mahasiswa buat tugas/input
   nilai/penilaian → 403.

**Perbaikan pendukung:** prop `invalid` ditambahkan ke `src/components/ui/input.tsx`
(border merah + `aria-invalid`).

### Batch 3 — Rute nav (selesai, 9 Okt)
Semua 10 rute yang tadinya 404 sekarang sudah punya halaman (pola Server Component
`getCurrentUser` → guard → query Prisma → DTO + komponen client, EmptyState, UI Bahasa
Indonesia, ikon Lucide `strokeWidth={1.5}`):

- `/mahasiswa/profil` + `panel-krs.tsx` — KRS semester ini & riwayat lintas semester
  (tab Radix, total SKS, badge Diambil/Lulus/Drop), kartu profil, ketentuan akademik.
- `/mahasiswa/jadwal` — tabel jadwal mingguan (urut hari & jam), 4 StatCard, empty state.
- `/dosen/jadwal` — kelas diampu + jumlah mahasiswa per kelas.
- `/dosen/rekap` — per kelas: tabel NIM/Nama/kehadiran (H/S/I/A + % + badge di bawah 75%)
  + nilai (Tugas/UTS/UAS/Akhir/Grade), ringkasan kelas.
- `/kaprodi/kehadiran` — agregat semua kelas + daftar 10 mahasiswa berisiko (<75%).
- `/kaprodi/dosen` — profil dosen, beban kelas, mahasiswa terdampak, jumlah tugas, akun.
- `/kaprodi/laporan` — 3 grafik (kehadiran/MK, tren/bulan, distribusi nilai) + tabel
  rekap + **tombol ekspor CSV** (`rekap-kelas.csv`, `rekap-mahasiswa.csv`).
- `/kaprodi/manajemen` + `panel-manajemen.tsx` — tab Mata kuliah (tambah + nonaktifkan),
  Dosen (aktif/nonaktif + sinkron akun login), Semester (set aktif idempoten).
- 3 halaman pengumuman di tiap peran + `panel-pengumuman.tsx`.

**API baru (6 rute):**

| Endpoint | Peran | Fungsi |
|---|---|---|
| `GET/POST /api/pengumuman` | baca semua peran / tulis dosen–kaprodi | daftar sesuai cakupan, terbitkan (prodi/kelas) + notifikasi penerima |
| `DELETE /api/pengumuman/[id]` | dosen (punya sendiri), kaprodi (semua) | hapus pengumuman |
| `POST /api/manajemen/mk` | kaprodi | tambah mata kuliah (validasi kode unik, sks) |
| `PATCH /api/manajemen/mk/[id]` | kaprodi | aktif/nonaktif (soft delete `deletedAt`) |
| `PATCH /api/manajemen/dosen/[id]` | kaprodi | aktif/nonaktif + sinkron `user.status` |
| `PATCH /api/manajemen/semester/[id]` | kaprodi | set semester aktif (transaksi, menonaktifkan yang lain) |

**Asersi e2e baru:** 10 halaman Batch 3 + 5 asersi alur pengumuman → total **61**.

### Batch 4 — poles pertama (selesai, 9 Okt)
- **SSE per-user** — `sse-bus.ts` memetakan listener per `userId`; `/api/events` mendaftar
  dengan `payload.sub`; `kirimNotifikasi` mengarahkan toast ke target; route absensi
  dikoreksi (buka sesi → peserta kelas, check-in → dosen pengampu, absen manual → dosen).
- **notifCount asli** — `topbar.tsx` membaca `/api/notifikasi/ringkasan` (jumlah belum
  dibaca dari DB) alih-alih `useState(3)` bohongan; SSE tetap menaikkan badge real-time.
- **Ekspor CSV** (parsial dari "Ekspor Excel/PDF") — `TombolCSV` di halaman laporan.

> **Insiden sesi ini (bukan bug):** `npm run dev` berjalan bersamaan dengan build produksi
> → keduanya menulis folder `.next` yang sama → `Cannot find module './vendor-chunks/@tanstack.js'`.
> Solusi: matikan semua proses node-Next, hapus `.next`, build ulang. Detail di §6.

### Batch 5 — permintaan kaprodi, dosen & alur akademik (selesai, 9 Okt)

**1. Fix kehadiran >100% per mata kuliah.**
Akar masalah: `absensi.groupBy({ by: ["mahasiswaId","status"] })` **tanpa pemisah kelas**
→ hadir mahasiswa di kelas lain ikut terhitung pada satu kelas. Solusi:
`src/lib/kehadiran.ts` (`muatRincianKehadiran`, `hitunganKelas`, `HITUNGAN_KOSONG`)
mengelompokkan absensi per **(kelas, mahasiswa)** lewat `pertemuan`. Halaman
`/kaprodi/kehadiran` & `/kaprodi/laporan` di-refactor memakai helper ini (CSV ikut benar);
`statistikKehadiran` di `grade.ts` diklamp `Math.min(100, …)` sebagai jaring aman.
Asersi e2e: "Kehadiran per mata kuliah tidak melebihi 100%".

**2. Profil kaprodi 404 → `/kaprodi/profil`** + menu "Profil" di `rbac.ts`.

**3. Kaprodi (operator) menambah akun mahasiswa & dosen.**
- API: `POST /api/manajemen/dosen` & `POST /api/manajemen/mahasiswa` (kaprodi-only,
  validasi unik email/NIP/NIM, hash `bcryptjs`, transaksi `User`+profil, tulis audit).
- UI: `panel-manajemen.tsx` — dialog "Tambah dosen" di tab Dosen + tab **Mahasiswa**
  (daftar + dialog "Tambah mahasiswa"). Halaman memuat daftar mahasiswa.

**4. Dosen menambah pertemuan.**
- API: `POST /api/pertemuan` — hanya dosen **pengampu** kelas, nomor otomatis `max+1`.
- UI: tombol "Tambah pertemuan" di `panel-sesi.tsx` (`/dosen/absensi`) + dialog tanggal/topik.

**5. Alur pengajuan KRS.**
- Skema: enum `StatusKRS` + nilai `pengajuan` (via `prisma db push`).
- API: `POST /api/krs` (mahasiswa mengajukan kelas semester aktif → status `pengajuan`,
  baris `drop` dihidupkan kembali, notifikasi ke kaprodi) dan `PATCH /api/krs/[id]`
  (kaprodi `terima` → `diambil`, `tolak` → baris dihapus + notifikasi + audit).
- UI: `form-pengajuan-krs.tsx` di `/mahasiswa/profil` (pilih kelas → ajukan) +
  tab **Validasi KRS** di `panel-manajemen.tsx` (badge jumlah antrean, tombol Terima/Tolak).

**6. Surat izin mahasiswa.**
- API: `POST /api/surat-izin` (multipart; PDF/JPG/PNG maks 5 MB, disimpan ke
  `public/uploads/surat-izin/`, satu surat per `absensiId`, notifikasi ke dosen pengampu)
  dan `PATCH /api/surat-izin/[id]` (dosen pengampu `terima` → surat disetujui + absensi
  jadi `izin`; `tolak` → ditolak).
- UI: `tombol-surat.tsx` di tabel riwayat `/mahasiswa/absensi` (kolom "Surat izin") +
  `panel-surat-izin.tsx` di `/dosen/absensi` (daftar menunggu, lihat berkas, Setujui/Tolak).

**7. Kalender akademik.**
- Halaman bersama `/kalender-akademik` (semua peran; menu ditambah di `rbac.ts`),
  `panel-kalender.tsx` mengelompokkan agenda per bulan.
- API: `POST /api/kalender` & `DELETE /api/kalender/[id]` (kaprodi-only, audit).

**Asersi e2e baru (28):** profil kaprodi, kalender di 3 peran, manajemen akun
(dosen+mahasiswa+login+409+403), tambah pertemuan (+403), alur KRS lengkap
(ajukan/status/setujui/tolak/duplikat/403), kalender (tambah/hapus/403),
surat izin (unggah/setujui/absensi→izin), konsistensi kehadiran ≤100%.
Total **89/89**.

### Batch 6 — perbaikan profil, kelola akun & poles UI (selesai, 9 Okt)

**1. Akar error `/kaprodi/profil` (kode galat `872332822`).**
Penyebab: helper `inisial()` diekspor dari `avatar.tsx` yang ber-`"use client"`, lalu
**dipanggil saat render Server Component** → Next mengubahnya menjadi *client reference*
sehingga muncul `TypeError: u is not a function` (kode galat `872332822`). Solusi:
`inisial()` dipindah ke `src/lib/utils.ts` (server-safe); importer diperbarui
(`kaprodi/profil`, `dosen/profil`, `topbar`); fungsi dibuat defensif untuk nama kosong.

**2. Halaman profil dosen `/dosen/profil`** (dulu 404) + menu "Profil" di `rbac.ts`.
Berisi StatCard (kelas diampu, mahasiswa, jadwal, status), data pribadi, ketentuan
mengajar, dan daftar kelas yang diampu.

**3. Kaprodi dapat membuat akun kaprodi lain.**
`POST /api/manajemen/dosen` menerima `role` (`dosen` | `kaprodi`); dialog "Tambah akun"
di tab Dosen kini punya pilihan **Peran akun**, dan tabel menampilkan badge Dosen/Kaprodi.

**4. Fitur Hapus akun untuk semua peran.**
- `DELETE /api/manajemen/dosen/[id]` (dosen & kaprodi) dan
  `DELETE /api/manajemen/mahasiswa/[id]` (mahasiswa) — hanya kaprodi.
- **Pengaman lockout:** tidak bisa menonaktifkan/menghapus **akun sendiri**, dan kaprodi
  aktif terakhir tidak bisa dinonaktifkan/dihapus.
- **Pengaman integritas data:** akun dosen yang masih mengampu kelas/memiliki sesi, tugas,
  pengumuman, atau riwayat → **409**; mahasiswa yang masih punya KRS/absensi/tugas/nilai
  → **409**. Akun sampah tanpa jejak dihapus permanen (cascade `User`+profil+sessions).
- UI: tombol **Hapus** di tab Dosen/Kaprodi dan Mahasiswa (`panel-manajemen.tsx`), dengan
  dialog konfirmasi.

**5. Poles UI (modern, ceria, beranimasi).**
- Token: radius kartu 16px / input 10px, `--shadow-card` + `--shadow-card-hover`, latar
  `body` bergradasi radial.
- Animasi Tailwind baru: `rise` (kartu masuk), `float`, `gradient-pan`; dihormati oleh
  `prefers-reduced-motion`.
- Gradasi merek `bg/text-brand-gradient` (stop lolos kontras AA) pada tombol utama, brand
  sidebar, dan aksen judul.
- `Card`/`StatCard` elevasi lembut + hover naik; ikon StatCard dalam chip gradasi; sidebar
  item aktif bergradasi + batang aksen; `Button` gradasi + transisi halus.

**Asersi e2e baru (10):** `/dosen/profil` render, buat akun kaprodi + login, tolak
nonaktif/hapus diri sendiri, hapus kaprodi tanpa jejak, buat+login+hapus mahasiswa,
tolak hapus mahasiswa berjejak (409). Total **99/99**.

---

## 3. Yang BELUM selesai

> ✅ **Batch 3 sudah tuntas** — semua 10 rute nav kini punya halaman (lihat Bagian 2).

### Batch 4/5/6 — yang masih tersisa (belum dikerjakan)
- **Ekspor Excel/PDF penuh** (rekap kehadiran & nilai) — ekspor CSV sudah ada di
  `/kaprodi/laporan`; Excel/PDF tinggal wrapper.
- Reminder/pengingat via Vercel Cron (`vercel.json` crons masih **pending**).
- Dark mode belum diverifikasi menyeluruh per halaman.
- Cmd+K command palette perlu dipastikan terhubung ke seluruh menu baru Batch 3–5.

> ✅ **Batch 5 tuntas** — surat izin (unggah + persetujuan dosen), kalender akademik UI,
> dan alur pengajuan/persetujuan KRS sudah selesai (lihat Bagian 2).

> ✅ **Batch 6 tuntas** — akar error profil kaprodi (`872332822`) diperbaiki, halaman profil
> dosen dibuat, akun kaprodi lain bisa dibuat, dan hapus akun (semua peran) dengan pengaman
> lockout tersedia (lihat Bagian 2).

### Poles kecil yang diketahui
- Belum ada repo git — **belum ada commit sama sekali**.

---

## 4. Error yang sedang terjadi

**Tidak ada error aktif.** Kondisi terakhir benar-benar bersih:
`npx tsc --noEmit` = 0 error, `npm run build` = sukses **59 rute**,
`npx tsx scripts/e2e.ts` = **99/99**.

### Soal halaman Error State
File-nya `src/app/(dashboard)/error.tsx` (baru dibuat batch 2). Ini **error boundary bawaan
Next.js** — akan muncul **hanya jika sebuah Server Component melempar exception saat render**
(bukan untuk 404, bukan untuk galat validasi form). Kalau besok Anda melihatnya, penyebab
paling mungkin, dari yang sering ke jarang:

1. **PostgreSQL lokal tidak jalan.** Prisma akan `ECONNREFUSED` → query melempar → error page.
   Cek: `Get-NetTCPConnection -LocalPort 5433`. Solusi: `npm.cmd run db:up`.
2. **Koneksi DB terputus** (embedded-postgres sempat mati / laptop sleep).
   Solusi sama: `npm.cmd run db:up`, atau `npm.cmd run db:setup` bila DB belum pernah dibuat.
3. **Query yang memakai relasi salah / data konsisten** — mis. akses `x.tahunAkademik.tahun`
   padahal field-nya `x.tahun.nama` (pernah terjadi saat batch 2, sudah diperbaiki).
4. **Fungsi dari modul `"use client"` dipanggil di Server Component** → Next mengubahnya
   menjadi *client reference* sehingga muncul `TypeError: … is not a function` (kode galat
   `872332822` pada `/kaprodi/profil`). Pastikan helper murni diletakkan di file tanpa
   `"use client"` (mis. `src/lib/utils.ts`).
5. **`.next` basi** — kalau Anda ganti kode lalu server lama masih hidup, chunk bisa bentrok
   (halaman error / asset 404). Solusi: hentikan `next start`, `npm.cmd run build`, jalankan lagi.

Di halaman error tersebut ada **kode galat (digest)** — sebutkan kode itu kalau minta bantuan,
sangat membantu melacak baris aslinya di server.

**Error non-bloking yang sudah diketahui** (sudah dibereskan):
- ~~`notifCount` topbar angka bohong~~ → sekarang membaca `/api/notifikasi/ringkasan`.
- ~~SSE broadcast global~~ → sekarang per-user (`sse-bus.ts`).
- ~~`/kaprodi/profil` error `872332822` (`TypeError: u is not a function`)~~ → akar masalah
  helper `inisial()` dari modul `"use client"` dipanggil di Server Component; dipindah ke
  `src/lib/utils.ts` (lihat Batch 6).
- E2E absensi pernah tidak idempoten (pertemuan uji sudah punya absensi dari run sebelumnya →
  3 test gagal). **Sudah diperbaiki** dengan `deleteMany` setup di `scripts/e2e.ts`.

---

## 5. Langkah pertama saat melanjutkan besok

Urutan ini paling aman (asumsi komputer baru dinyalakan):

```powershell
cd "D:\5. Project\7. Project_web_Absensi_FKIP"

# 1. Nyalakan PostgreSQL lokal (port 5433, db absensi_fkip)
npm.cmd run db:up

# 2. Cek server: kalau belum jalan, build + start
npm.cmd run build
npm.cmd start          # → http://localhost:3000

# 3. Pastikan masih hijau sebelum menyentuh kode
npx.cmd tsc --noEmit
npx.cmd tsx scripts/e2e.ts    # harus 99/99
```

> ⚠️ **`npm start` menyajikan hasil build `next build`.** Setiap kali mengubah kode, wajib
> hentikan server dulu (hentikan PID yang listen port 3000), `npm.cmd run build`, lalu
> `npm.cmd start` lagi. Build ≠ auto-reload.

**Batch 6 sudah tuntas.** Prioritas berikutnya:
1. Ekspor Excel/PDF penuh (CSV dasar sudah ada di `/kaprodi/laporan`).
2. Vercel Cron reminder + verifikasi dark mode + Cmd+K untuk seluruh menu.
3. Inisialisasi git + commit pertama.

**Pola yang harus diikuti** (lihat contoh di halaman yang sudah ada):
`page.tsx` (Server Component: `getCurrentUser` → guard role → query Prisma → pass DTO)
+ komponen `client` untuk interaksi. **Setiap halaman wajib punya** empty state
(`EmptyState`), loading (`loading.tsx` di level `(dashboard)` sudah global), dan error state.
Semua teks UI dalam Bahasa Indonesia, ikon Lucide stroke 1.5, tanpa emoji/Lorem ipsum.

---

## 6. Catatan penting

### Menjalankan
| Perintah | Fungsi |
|---|---|
| `npm.cmd run db:up` / `db:down` | start/stop PostgreSQL embedded (port **5433**) |
| `npm.cmd run db:setup` | `db:up` + `db push` + `db:seed` (sekali di awal) |
| `npm.cmd run db:seed` | isi ulang data demo (menimpa) |
| `npm.cmd run build` → `npm.cmd start` | mode produksi (yang dipakai untuk e2e) |
| `npm.cmd run dev` | dev server (auto-reload) |
| `npm.cmd run db:studio` | Prisma Studio |
| `npx.cmd tsc --noEmit` | cek tipe |
| `npx.cmd tsx scripts/e2e.ts` | smoke test 99 asersi (butuh server + DB nyala) |

> **Windows/PowerShell:** pakai `npm.cmd` dan `npx.cmd` (execution policy). Node v24.21.0.
>
> **`EADDRINUSE` di port 3000** = server (dev/start) sudah jalan; jangan mulai server
> kedua — cukup buka `http://localhost:3000`, atau matikan dulu proses node-Next yang lama.
>
> **Jangan campur `dev` dengan `build`/`start`** — dua mode ini menulis folder `.next` yang
> sama dan saling menimpa (gejala: `Cannot find module './vendor-chunks/@tanstack.js'`).
> Solusi: matikan semua proses node-Next, hapus `.next`, build ulang.

### Koneksi database
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/absensi_fkip?schema=public"
```
Port **5433** (bukan 5432) — PostgreSQL embedded via paket `embedded-postgres`.

### Akun demo (semua password: `password123`)
| Peran | Email |
|---|---|
| Kaprodi | `kaprodi@wahidiyah.ac.id` |
| Dosen pengampu Kalkulus I | `muhammad.fauzi@wahidiyah.ac.id` (NIP `199001052015031007`) |
| Dosen lain (7) | `siti.nurhaliza@wahidiyah.ac.id`, `budi.hartono@…`, dst. |
| Mahasiswa | `mahasiswa1@wahidiyah.ac.id` … `mahasiswa40@wahidiyah.ac.id` |

Chip login demo hanya muncul saat `NODE_ENV !== "production"`.

### Aturan main yang jangan dilanggar
- **Nilai & absensi tidak pernah dihapus** — hanya ditimpa lewat `riwayat_perubahan`.
- Skala nilai: A≥80, B≥70, C≥60, D≥50, E<50 (skala 4.0). Default bobot 30/30/40, bisa beda per kelas.
- 16 pertemuan/kelas (dapat ditambah dosen pengampu), syarat kehadiran minimal **75%**, satu semester aktif saja.
- Aset akademik pakai **soft delete** (`deletedAt`); KRS mahasiswa diajukan mahasiswa lalu **divalidasi kaprodi**.
- Surat izin disimpan di `public/uploads/surat-izin/` (satu per absensi); disetujui dosen → absensi jadi `izin`.
- QR absensi selalu diturunkan dari payload HMAC bertanda tangan (`payload.sid`), bukan body request.
- Semua aksi CRUD/check-in/validasi ditulis ke `audit_log`.

### Struktur yang sering dirujuk
- Design token: `src/app/globals.css` → `tailwind.config.ts` (aksen emerald `#047857`,
  netral stone, radius 10/16/999, border 1px neutral-200, gradasi merek `bg-brand-gradient`).
- Menu sidebar per peran: **`src/lib/rbac.ts`** (satu sumber kebenaran navigasi).
- Kalkulasi akademik: `src/lib/grade.ts` (`hitungAkhir`, `hitungGrade`, `hitungIpk`,
  `snapshotNilai`/`parseSnapshot`/`snapshotSama`, `statistikKehadiran`).
- Referensi pola halaman: `src/app/(dashboard)/dosen/absensi/page.tsx`.
- Referensi pola API ter-guard: `src/app/api/absensi/manual/route.ts`.
