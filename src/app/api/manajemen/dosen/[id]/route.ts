import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";
import { validasiSemesterKe } from "@/lib/semester";
import { jenisSemesterAktif } from "@/lib/semester-server";
import { rincianHapusDosen, totalRincian } from "@/lib/hapus";
import type { Prisma } from "@prisma/client";

/**
 * PATCH /api/manajemen/dosen/[id] — kaprodi memperbarui profil atau status akun
 * dosen/kaprodi. Status akun `User` ikut disinkronkan bila status diubah.
 * Body: { status?, nama?, nip?, gelar?, bidangStudi?, semesterKe?, email?, telepon? }
 * Pengaman status: tidak dapat menonaktifkan akun sendiri, dan kaprodi aktif
 * terakhir tidak boleh dinonaktifkan agar tidak terjadi lockout.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  let body: {
    status?: "aktif" | "nonaktif";
    nama?: string;
    nip?: string;
    gelar?: string;
    bidangStudi?: string;
    semesterKe?: number | string | null;
    email?: string;
    telepon?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const dosen = await prisma.dosen.findUnique({
    where: { id },
    include: { user: { select: { role: true, email: true } } },
  });
  if (!dosen) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const dataDosen: Prisma.DosenUpdateInput = {};
  const dataUser: Prisma.UserUpdateInput = {};
  const lama: Record<string, unknown> = {};
  const baru: Record<string, unknown> = {};

  if (body.nama !== undefined) {
    const nama = String(body.nama).trim();
    if (nama.length < 3 || nama.length > 120) {
      return NextResponse.json({ error: "Nama harus 3–120 karakter." }, { status: 400 });
    }
    dataDosen.nama = nama;
    lama.nama = dosen.nama;
    baru.nama = nama;
  }

  if (body.nip !== undefined) {
    const nip = String(body.nip).trim();
    if (!/^[A-Za-z0-9.\-/]{3,30}$/.test(nip)) {
      return NextResponse.json(
        { error: "NIP wajib diisi (3–30 karakter huruf/angka)." },
        { status: 400 }
      );
    }
    if (nip !== dosen.nip) {
      const dipakai = await prisma.dosen.findUnique({ where: { nip }, select: { id: true } });
      if (dipakai) {
        return NextResponse.json({ error: `NIP ${nip} sudah digunakan.` }, { status: 409 });
      }
    }
    dataDosen.nip = nip;
    lama.nip = dosen.nip;
    baru.nip = nip;
  }

  if (body.gelar !== undefined) {
    const gelar = String(body.gelar).trim() || null;
    if ((gelar?.length ?? 0) > 60) {
      return NextResponse.json({ error: "Gelar maksimal 60 karakter." }, { status: 400 });
    }
    dataDosen.gelar = gelar;
    lama.gelar = dosen.gelar;
    baru.gelar = gelar;
  }

  if (body.bidangStudi !== undefined) {
    const bidangStudi = String(body.bidangStudi).trim() || null;
    if ((bidangStudi?.length ?? 0) > 80) {
      return NextResponse.json({ error: "Bidang studi maksimal 80 karakter." }, { status: 400 });
    }
    dataDosen.bidangStudi = bidangStudi;
    lama.bidangStudi = dosen.bidangStudi;
    baru.bidangStudi = bidangStudi;
  }

  if (body.semesterKe !== undefined) {
    const parsed = validasiSemesterKe(body.semesterKe, await jenisSemesterAktif());
    if (!parsed.ok) {
      const sama = String(dosen.semesterKe ?? "") === String(body.semesterKe ?? "");
      if (!sama) {
        return NextResponse.json({ error: parsed.pesan }, { status: 400 });
      }
    } else {
      dataDosen.semesterKe = parsed.value;
      lama.semesterKe = dosen.semesterKe;
      baru.semesterKe = parsed.value;
    }
  }

  if (body.telepon !== undefined) {
    const telepon = String(body.telepon).trim() || null;
    if ((telepon?.length ?? 0) > 30) {
      return NextResponse.json({ error: "Telepon maksimal 30 karakter." }, { status: 400 });
    }
    dataDosen.telepon = telepon;
    lama.telepon = dosen.telepon;
    baru.telepon = telepon;
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
    }
    if (email !== dosen.user.email) {
      const dipakai = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (dipakai) {
        return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
      }
    }
    dataUser.email = email;
    lama.email = dosen.user.email;
    baru.email = email;
  }

  if (body.status !== undefined) {
    if (body.status !== "aktif" && body.status !== "nonaktif") {
      return NextResponse.json({ error: "Status harus aktif atau nonaktif." }, { status: 400 });
    }
    if (body.status === "nonaktif" && dosen.userId === user.userId) {
      return NextResponse.json(
        { error: "Anda tidak dapat menonaktifkan akun Anda sendiri." },
        { status: 400 }
      );
    }
    if (body.status === "nonaktif" && dosen.user.role === "kaprodi") {
      const kaprodiAktif = await prisma.user.count({
        where: { role: "kaprodi", status: "aktif" },
      });
      if (kaprodiAktif <= 1) {
        return NextResponse.json(
          { error: "Minimal harus ada satu kaprodi aktif. Tambah kaprodi lain terlebih dahulu." },
          { status: 400 }
        );
      }
    }
    dataDosen.status = body.status;
    dataUser.status = body.status;
    lama.status = dosen.status;
    baru.status = body.status;
  }

  if (Object.keys(dataDosen).length === 0 && Object.keys(dataUser).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan yang dikirim." }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(dataDosen).length > 0) {
      await tx.dosen.update({ where: { id }, data: dataDosen });
    }
    if (Object.keys(dataUser).length > 0) {
      await tx.user.update({ where: { id: dosen.userId }, data: dataUser });
    }
  });

  await catatAudit({
    userId: user.userId,
    aksi: "update",
    entityType: dosen.user.role === "kaprodi" ? "kaprodi" : "dosen",
    entityId: id,
    oldValue: lama,
    newValue: baru,
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/manajemen/dosen/[id] — rincian data terkait untuk dialog hapus.
 * Hanya kaprodi yang boleh melihat & menghapus.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  const dosen = await prisma.dosen.findUnique({
    where: { id },
    include: { user: { select: { id: true, role: true } } },
  });
  if (!dosen) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  const rincian = await rincianHapusDosen(id, dosen.userId);
  return NextResponse.json({
    label: `${dosen.nama} (${dosen.nip})`,
    rincian,
    total: totalRincian(rincian),
  });
}

/**
 * DELETE /api/manajemen/dosen/[id] — hapus permanen akun dosen/kaprodi (hard
 * delete). Kelas yang diampu, sesi absensi, tugas, pengumuman, dan riwayat
 * terkait ikut terhapus (cascade). Jumlah data ditampilkan di dialog konfirmasi.
 * Ditolak untuk akun sendiri dan kaprodi aktif terakhir.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const { id } = await params;
  const dosen = await prisma.dosen.findUnique({
    where: { id },
    include: { user: { select: { role: true } } },
  });
  if (!dosen) {
    return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  }

  if (dosen.userId === user.userId) {
    return NextResponse.json(
      { error: "Anda tidak dapat menghapus akun Anda sendiri." },
      { status: 400 }
    );
  }

  if (dosen.user.role === "kaprodi") {
    const totalKaprodi = await prisma.user.count({ where: { role: "kaprodi" } });
    if (totalKaprodi <= 1) {
      return NextResponse.json(
        { error: "Minimal harus ada satu akun kaprodi. Tambah kaprodi lain terlebih dahulu." },
        { status: 400 }
      );
    }
  }

  const rincian = await rincianHapusDosen(id, dosen.userId);

  await prisma.$transaction(async (tx) => {
    // Bersihkan relasi yang menghalangi (FK Restrict) sebelum User dihapus.
    await tx.riwayatPerubahan.deleteMany({
      where: { OR: [{ diubahOlehId: dosen.userId }, { reviewedById: dosen.userId }] },
    });
    await tx.pengumuman.deleteMany({ where: { createdById: dosen.userId } });
    await tx.tugas.deleteMany({ where: { createdById: id } });
    await tx.sesiAbsensi.deleteMany({ where: { dosenId: id } });
    // Kelas cascade ke KRS, pertemuan, absensi, nilai, jadwal, dll.
    await tx.kelas.deleteMany({ where: { dosenId: id } });
    // Terakhir: hapus User → Dosen ikut cascade.
    await tx.user.delete({ where: { id: dosen.userId } });
  });

  await catatAudit({
    userId: user.userId,
    aksi: "delete",
    entityType: dosen.user.role === "kaprodi" ? "kaprodi" : "dosen",
    entityId: id,
    oldValue: {
      nip: dosen.nip,
      nama: dosen.nama,
      role: dosen.user.role,
      dihapus: rincian,
    },
  });

  return NextResponse.json({ ok: true });
}
