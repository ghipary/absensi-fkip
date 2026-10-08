/**
 * Reset sekali-pakai: "Reset transaksi".
 *
 * Menyisakan hanya 3 akun (1 kaprodi, 1 dosen, 1 mahasiswa) dan
 * mempertahankan kurikulum (MataKuliah), Semester, TahunAkademik, serta
 * KalenderAkademik. Menghapus SELURUH data transaksi (kelas, KRS, absensi,
 * nilai, tugas, submission, pertemuan, jadwal, pengumuman, notifikasi,
 * audit log, riwayat) dan semua akun profil/karyawan lain.
 *
 * Password 3 akun yang disisakan direset ke `password123`.
 * Untuk memulihkan data demo penuh: `npm run db:seed`.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const KEEP = {
  kaprodi: "kaprodi@wahidiyah.ac.id",
  dosen: "muhammad.fauzi@wahidiyah.ac.id",
  mahasiswa: "mahasiswa1@wahidiyah.ac.id",
} as const;
const EMAIL_DISIMPAN = Object.values(KEEP);

async function main() {
  // Pastikan ketiga akun ada sebelum menghapus apa pun.
  const ada = await prisma.user.findMany({
    where: { email: { in: EMAIL_DISIMPAN } },
    select: { email: true, role: true },
  });
  const petaRole = new Map(ada.map((u) => [u.email, u.role]));
  for (const [peran, email] of Object.entries(KEEP)) {
    if (petaRole.get(email) !== peran) {
      throw new Error(
        `Akun wajib tak ditemukan/role salah: ${email} (butuh ${peran}, dapat ${petaRole.get(email) ?? "tidak ada"})`
      );
    }
  }

  // 1) Hapus seluruh data transaksi (urutan menghormati FK).
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
    prisma.session.deleteMany(),
  ]);

  // 2) Hapus profil & akun selain yang disisakan.
  await prisma.mahasiswa.deleteMany({
    where: { user: { email: { not: KEEP.mahasiswa } } },
  });
  await prisma.dosen.deleteMany({
    where: { user: { email: { notIn: [KEEP.kaprodi, KEEP.dosen] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { notIn: EMAIL_DISIMPAN } },
  });

  // 3) Reset password & status akun yang disisakan.
  const hash = await bcrypt.hash("password123", 10);
  await prisma.user.updateMany({
    where: { email: { in: EMAIL_DISIMPAN } },
    data: { passwordHash: hash, status: "aktif" },
  });
  await prisma.dosen.updateMany({
    where: { user: { email: { in: [KEEP.kaprodi, KEEP.dosen] } } },
    data: { status: "aktif" },
  });
  await prisma.mahasiswa.updateMany({
    where: { user: { email: KEEP.mahasiswa } },
    data: { status: "aktif" },
  });

  // 4) Ringkasan.
  const [users, dosen, mhs, mk, kelas, semester, kalender] = await Promise.all([
    prisma.user.count(),
    prisma.dosen.count(),
    prisma.mahasiswa.count(),
    prisma.mataKuliah.count(),
    prisma.kelas.count(),
    prisma.semester.count(),
    prisma.kalenderAkademik.count(),
  ]);
  console.log("✅ Reset transaksi selesai.");
  console.log(
    `   users=${users} dosen=${dosen} mahasiswa=${mhs} mataKuliah=${mk} kelas=${kelas} semester=${semester} kalender=${kalender}`
  );
  const sisaAkun = await prisma.user.findMany({
    select: { email: true, role: true },
    orderBy: { role: "asc" },
  });
  for (const u of sisaAkun) console.log(`   - ${u.role.padEnd(9)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error("Reset gagal:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
