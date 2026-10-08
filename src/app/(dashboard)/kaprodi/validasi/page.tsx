import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ShieldCheck, Clock, CheckCircle2, XCircle, History } from "lucide-react";
import { PanelValidasi } from "./panel-validasi";

export const metadata: Metadata = { title: "Validasi Data" };

export default async function HalamanValidasi() {
  const user = await getCurrentUser();
  if (!user || user.role !== "kaprodi") redirect("/login");

  const menunggu = await prisma.riwayatPerubahan.findMany({
    where: { tipe: "nilai", status: "menunggu" },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      pelaku: {
        select: {
          email: true,
          dosen: { select: { nama: true, nip: true } },
          mahasiswa: { select: { nama: true, nim: true } },
        },
      },
      nilai: {
        select: {
          mahasiswa: { select: { nama: true, nim: true } },
          kelas: {
            select: {
              kodeKelas: true,
              dosen: { select: { nama: true } },
              mataKuliah: { select: { kode: true, nama: true } },
            },
          },
        },
      },
    },
  });

  const [disetujui, ditolak, totalRiwayat] = await Promise.all([
    prisma.riwayatPerubahan.count({ where: { tipe: "nilai", status: "disetujui" } }),
    prisma.riwayatPerubahan.count({ where: { tipe: "nilai", status: "ditolak" } }),
    prisma.riwayatPerubahan.count({ where: { tipe: "nilai" } }),
  ]);

  const riwayatTerkini = await prisma.riwayatPerubahan.findMany({
    where: { tipe: "nilai" },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      pelaku: { select: { email: true, dosen: { select: { nama: true } } } },
      nilai: {
        select: {
          mahasiswa: { select: { nama: true, nim: true } },
          kelas: { select: { mataKuliah: { select: { kode: true } }, kodeKelas: true } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader
        judul="Validasi Data"
        deskripsi="Tinjau perubahan nilai yang diajukan dosen pengampu. Menolak akan mengembalikan nilai ke kondisi sebelumnya — riwayat tetap tercatat seluruhnya."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Menunggu validasi"
          value={menunggu.length}
          ikon={<Clock className="h-4 w-4" strokeWidth={1.5} />}
          sub={menunggu.length > 0 ? "perlu tindakan" : "antrian kosong"}
        />
        <StatCard
          label="Disetujui"
          value={disetujui}
          ikon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
        />
        <StatCard
          label="Ditolak"
          value={ditolak}
          ikon={<XCircle className="h-4 w-4" strokeWidth={1.5} />}
        />
        <StatCard
          label="Total riwayat nilai"
          value={totalRiwayat}
          ikon={<History className="h-4 w-4" strokeWidth={1.5} />}
          sub="tidak pernah dihapus"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PanelValidasi
            antrean={menunggu.map((r) => ({
              id: r.id,
              alasan: r.alasan,
              createdAt: r.createdAt.toISOString(),
              pengaju: r.pelaku.dosen?.nama ?? r.pelaku.mahasiswa?.nama ?? r.pelaku.email,
              mahasiswa: r.nilai
                ? `${r.nilai.mahasiswa.nama} (${r.nilai.mahasiswa.nim})`
                : "—",
              kelas: r.nilai
                ? `${r.nilai.kelas.mataKuliah.kode} · ${r.nilai.kelas.mataKuliah.nama} (${r.nilai.kelas.kodeKelas})`
                : "—",
              pengampu: r.nilai?.kelas.dosen.nama ?? "—",
              nilaiLama: r.nilaiLama,
              nilaiBaru: r.nilaiBaru,
            }))}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat terkini</CardTitle>
              <p className="text-xs text-fg-muted">
                Delapan perubahan nilai terakhir beserta status peninjauannya.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {riwayatTerkini.length === 0 ? (
                <EmptyState
                  compact
                  icon={History}
                  judul="Belum ada riwayat"
                  deskripsi="Setiap perubahan nilai yang tercatat akan tampil di sini."
                />
              ) : (
                riwayatTerkini.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between gap-3 rounded border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">
                        {r.nilai
                          ? `${r.nilai.kelas.mataKuliah.kode} · ${r.nilai.mahasiswa.nama}`
                          : "Perubahan nilai"}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {r.alasan ?? "Penyesuaian nilai"}
                      </p>
                      <p className="font-mono-nums text-2xs text-fg-subtle">
                        {r.pelaku.dosen?.nama ?? r.pelaku.email}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-pill border px-2 py-0.5 text-2xs font-medium " +
                        (r.status === "menunggu"
                          ? "border-warning-border bg-warning-bg text-warning-text"
                          : r.status === "ditolak"
                            ? "border-danger-border bg-danger-bg text-danger-text"
                            : r.status === "disetujui"
                              ? "border-success-border bg-success-bg text-success-text"
                              : "border-border bg-surface-muted text-fg-muted")
                      }
                    >
                      {r.status === "menunggu"
                        ? "menunggu"
                        : r.status === "disetujui"
                          ? "disetujui"
                          : r.status === "ditolak"
                            ? "ditolak"
                            : "otomatis"}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aturan validasi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-fg-muted">
              <p>
                <span className="font-medium text-fg">Setujui</span> — nilai yang diajukan
                dosen dinyatakan resmi dan status riwayat menjadi disetujui.
              </p>
              <p>
                <span className="font-medium text-fg">Tolak</span> — nilai otomatis
                dikembalikan ke snapshot sebelum perubahan, lalu dicatat sebagai riwayat
                baru.
              </p>
              <p className="text-xs text-fg-subtle">
                Nilai tidak pernah dihapus dari sistem; setiap perputaran status tercatat
                permanen di riwayat_perubahan beserta pelakunya.
              </p>
              <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                Hanya kaprodi yang dapat memproses antrean ini.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
