"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, Check, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/form-extras";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Num,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogKonfirmasiHapus } from "@/components/ui/dialog-konfirmasi-hapus";
import {
  cocokParitas,
  opsiSelectSemesterKe,
  type JenisSemester,
} from "@/lib/semester";
import type { RincianHapus } from "@/lib/hapus";

export type ItemMK = {
  id: string;
  kode: string;
  nama: string;
  sks: number;
  kategori: "wajib" | "pilihan";
  semesterKe: number | null;
  aktif: boolean;
  jumlahKelas: number;
};

export type ItemDosen = {
  id: string;
  userId: string;
  nama: string;
  nip: string;
  gelar: string | null;
  bidang: string | null;
  semesterKe: number | null;
  email: string;
  role: "dosen" | "kaprodi";
  status: string;
};

export type ItemSemester = {
  id: string;
  nama: string;
  tahun: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  isAktif: boolean;
};

export type ItemMahasiswa = {
  id: string;
  userId: string;
  nama: string;
  nim: string;
  angkatan: number;
  jenisKelamin: string;
  kelasMhs: string;
  semesterKe: number | null;
  email: string;
  status: string;
};

export type ItemKrsPengajuan = {
  id: string;
  mahasiswa: string;
  nim: string;
  kode: string;
  nama: string;
  kodeKelas: string;
  sks: number;
  diajukanPada: string;
};

export type ItemKelas = {
  id: string;
  mkId: string;
  mkKode: string;
  mkNama: string;
  sks: number;
  semesterId: string;
  semesterLabel: string;
  semesterAktif: boolean;
  dosenId: string;
  dosenNama: string;
  kodeKelas: string;
  kapasitas: number;
  jumlahMhs: number;
  jumlahPertemuan: number;
  jadwal: {
    hari: string;
    jamMulai: string;
    jamSelesai: string;
    ruang: string;
  } | null;
};

type Props = {
  mkList: ItemMK[];
  dosenList: ItemDosen[];
  semesterList: ItemSemester[];
  mahasiswaList: ItemMahasiswa[];
  kelasList: ItemKelas[];
  krsPengajuan: ItemKrsPengajuan[];
  userIdSaya: string;
};

/** Kirim PATCH/POST JSON dan kembalikan status + pesan galat (bila ada). */
async function kirimJson(
  method: "PATCH" | "POST",
  url: string,
  body: unknown
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Gagal menyimpan perubahan." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Tidak dapat terhubung ke server." };
  }
}

function formatTanggal(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PanelManajemen({
  mkList,
  dosenList,
  semesterList,
  mahasiswaList,
  kelasList,
  krsPengajuan,
  userIdSaya,
}: Props) {
  const router = useRouter();

  // Paritas semester aktif menentukan opsi "semester ke" pada tiap form.
  const jenisAktif = (semesterList.find((s) => s.isAktif)?.nama ??
    "Ganjil") as JenisSemester;
  const opsiSmtAktif = [
    { value: "", label: "Belum dipetakan" },
    ...opsiSelectSemesterKe(jenisAktif),
  ];

  const [bukaBuat, setBukaBuat] = React.useState(false);
  const [kode, setKode] = React.useState("");
  const [nama, setNama] = React.useState("");
  const [sks, setSks] = React.useState("3");
  const [kategori, setKategori] = React.useState<"wajib" | "pilihan">("wajib");
  const [smtMK, setSmtMK] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [prosesId, setProsesId] = React.useState<string | null>(null);

  // Dialog konfirmasi hapus permanen (hard delete)
  const [hapusTarget, setHapusTarget] = React.useState<{ url: string; label: string } | null>(
    null
  );
  const [hapusRincian, setHapusRincian] = React.useState<RincianHapus[]>([]);
  const [hapusTotal, setHapusTotal] = React.useState(0);
  const [hapusLoading, setHapusLoading] = React.useState(false);
  const [hapusProses, setHapusProses] = React.useState(false);
  const [hapusGalat, setHapusGalat] = React.useState<string | null>(null);

  // Dialog edit entitas (null = tertutup)
  const [editMK, setEditMK] = React.useState<ItemMK | null>(null);
  const [editDosen, setEditDosen] = React.useState<ItemDosen | null>(null);
  const [editMhs, setEditMhs] = React.useState<ItemMahasiswa | null>(null);
  const [editKelas, setEditKelas] = React.useState<ItemKelas | null>(null);
  const [bukaKelas, setBukaKelas] = React.useState(false);

  // Form tambah akun dosen / kaprodi
  const [bukaDosen, setBukaDosen] = React.useState(false);
  const [fd, setFd] = React.useState({
    role: "dosen" as "dosen" | "kaprodi",
    nama: "",
    nip: "",
    email: "",
    password: "",
    gelar: "",
    bidangStudi: "",
    semesterKe: "",
  });
  const [errDosen, setErrDosen] = React.useState<string | null>(null);
  const [simpanDosen, setSimpanDosen] = React.useState(false);

  // Form tambah akun mahasiswa
  const [bukaMhs, setBukaMhs] = React.useState(false);
  const [fm, setFm] = React.useState({
    nama: "",
    nim: "",
    angkatan: String(new Date().getFullYear()),
    jenisKelamin: "L",
    kelasMhs: "",
    email: "",
    password: "",
    semesterKe: "",
  });
  const [errMhs, setErrMhs] = React.useState<string | null>(null);
  const [simpanMhs, setSimpanMhs] = React.useState(false);

  async function buatAkun(
    url: string,
    body: unknown,
    setErr: (s: string | null) => void,
    setSimpan: (b: boolean) => void,
    onSukses: () => void
  ) {
    setErr(null);
    setSimpan(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error ?? "Gagal menyimpan akun.");
        return;
      }
      onSukses();
      router.refresh();
    } catch {
      setErr("Tidak dapat terhubung ke server.");
    } finally {
      setSimpan(false);
    }
  }

  async function kirimPatch(url: string, body: unknown, pesanGagal: string) {
    setProsesId(url);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? pesanGagal);
        return;
      }
      router.refresh();
    } catch {
      alert("Tidak dapat terhubung ke server.");
    } finally {
      setProsesId(null);
    }
  }

  /** Buka dialog konfirmasi: ambil rincian data terkait dari server lebih dulu. */
  async function mintaHapus(url: string, label: string) {
    setHapusTarget({ url, label });
    setHapusRincian([]);
    setHapusTotal(0);
    setHapusGalat(null);
    setHapusLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHapusGalat(data.error ?? "Gagal memuat data terkait.");
        return;
      }
      setHapusRincian(data.rincian ?? []);
      setHapusTotal(data.total ?? 0);
    } catch {
      setHapusGalat("Tidak dapat terhubung ke server.");
    } finally {
      setHapusLoading(false);
    }
  }

  /** Eksekusi hard delete setelah kaprodi menekan "Hapus Permanen". */
  async function konfirmasiHapus() {
    if (!hapusTarget) return;
    setHapusProses(true);
    setHapusGalat(null);
    try {
      const res = await fetch(hapusTarget.url, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHapusGalat(data.error ?? "Gagal menghapus.");
        return;
      }
      setHapusTarget(null);
      router.refresh();
    } catch {
      setHapusGalat("Tidak dapat terhubung ke server.");
    } finally {
      setHapusProses(false);
    }
  }

  function hapusKelas(kelas: ItemKelas) {
    mintaHapus(
      `/api/manajemen/kelas/${kelas.id}`,
      `${kelas.mkNama} — ${kelas.kodeKelas} (${kelas.semesterLabel})`
    );
  }

  async function buatMK(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMenyimpan(true);
    try {
      const res = await fetch("/api/manajemen/mk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode,
          nama,
          sks: Number(sks),
          kategori,
          semesterKe: smtMK === "" ? null : Number(smtMK),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah mata kuliah.");
        return;
      }
      setBukaBuat(false);
      setKode("");
      setNama("");
      setSks("3");
      setSmtMK("");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <>
    <Tabs defaultValue="mk">
      <TabsList>
        <TabsTrigger value="mk">Mata kuliah</TabsTrigger>
        <TabsTrigger value="kelas">Kelas</TabsTrigger>
        <TabsTrigger value="dosen">Dosen</TabsTrigger>
        <TabsTrigger value="mahasiswa">Mahasiswa</TabsTrigger>
        <TabsTrigger value="krs">
          Validasi KRS
          {krsPengajuan.length > 0 && (
            <span className="ml-1.5 rounded-pill bg-warning-bg px-1.5 text-2xs font-semibold text-warning-text">
              {krsPengajuan.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="semester">Semester</TabsTrigger>
      </TabsList>

      {/* ── Mata kuliah ─────────────────────────────── */}
      <TabsContent value="mk">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            {mkList.filter((m) => m.aktif).length} mata kuliah aktif dari {mkList.length} total.
          </p>
          <Dialog open={bukaBuat} onOpenChange={setBukaBuat}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Tambah mata kuliah
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah mata kuliah</DialogTitle>
                <DialogDescription>
                  Mata kuliah baru otomatis berstatus aktif.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={buatMK} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs font-medium text-fg-muted">Kode</span>
                    <Input
                      value={kode}
                      onChange={(e) => setKode(e.target.value.toUpperCase())}
                      placeholder="mis. PMK2102"
                      maxLength={12}
                      mono
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">SKS</span>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={sks}
                      onChange={(e) => setSks(e.target.value)}
                      required
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Nama mata kuliah</span>
                  <Input
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="mis. Statistika Dasar"
                    maxLength={120}
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Kategori</span>
                    <Select
                      value={kategori}
                      onChange={(e) => setKategori(e.target.value as "wajib" | "pilihan")}
                      options={[
                        { value: "wajib", label: "Wajib" },
                        { value: "pilihan", label: "Pilihan" },
                      ]}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">
                      Semester ke ({jenisAktif})
                    </span>
                    <Select
                      value={smtMK}
                      onChange={(e) => setSmtMK(e.target.value)}
                      options={opsiSmtAktif}
                    />
                  </label>
                </div>
                {error && (
                  <p className="flex items-start gap-1.5 text-sm text-danger-text">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setBukaBuat(false)}>
                    Batal
                  </Button>
                  <Button type="submit" loading={menyimpan}>
                    Simpan
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {mkList.length === 0 ? (
          <EmptyState compact judul="Belum ada mata kuliah" deskripsi="Belum ada data mata kuliah di sistem." />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-16 text-center">SKS</TableHead>
                  <TableHead className="w-24">Kategori</TableHead>
                  <TableHead className="w-24 text-center">Smt</TableHead>
                  <TableHead className="w-20 text-right">Kelas</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-44 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mkList.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Num className="text-fg-muted">{m.kode}</Num>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-fg">{m.nama}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Num className="text-fg-muted">{m.sks}</Num>
                    </TableCell>
                    <TableCell className="text-fg-muted capitalize">{m.kategori}</TableCell>
                    <TableCell className="text-center text-xs text-fg-muted">
                      {m.semesterKe === null ? "—" : `Smt ${m.semesterKe}`}
                    </TableCell>
                    <TableCell className="text-right">
                      <Num className="text-fg">{m.jumlahKelas}</Num>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={m.aktif ? "success" : "neutral"}>{m.aktif ? "Aktif" : "Nonaktif"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditMK(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          Edit
                        </Button>
                        <Button
                          variant={m.aktif ? "danger-ghost" : "secondary"}
                          size="sm"
                          onClick={() =>
                            kirimPatch(
                              `/api/manajemen/mk/${m.id}`,
                              { aktif: !m.aktif },
                              "Gagal mengubah status mata kuliah."
                            )
                          }
                          loading={prosesId === `/api/manajemen/mk/${m.id}`}
                        >
                          <Power className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          {m.aktif ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ── Kelas ───────────────────────────────────── */}
      <TabsContent value="kelas">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            {kelasList.length} kelas aktif. Buat kelas dengan mengaitkan mata kuliah, semester,
            dan dosen pengampu.
          </p>
          <Button size="sm" onClick={() => setBukaKelas(true)}>
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Buat kelas
          </Button>
        </div>
        {kelasList.length === 0 ? (
          <EmptyState
            compact
            judul="Belum ada kelas"
            deskripsi="Buat kelas untuk mengaitkan mata kuliah dengan dosen pengampu pada semester tertentu."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mata kuliah</TableHead>
                  <TableHead className="w-20 text-center">Kelas</TableHead>
                  <TableHead className="w-32">Semester</TableHead>
                  <TableHead>Dosen pengampu</TableHead>
                  <TableHead className="w-52">Jadwal</TableHead>
                  <TableHead className="w-16 text-right">Mhs</TableHead>
                  <TableHead className="w-40 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kelasList.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <span className="block font-medium text-fg">{k.mkNama}</span>
                      <span className="text-2xs text-fg-subtle">
                        {k.mkKode} · {k.sks} SKS
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="neutral">{k.kodeKelas}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {k.semesterLabel}
                      {k.semesterAktif && <span className="ml-1 text-accent-text">• aktif</span>}
                    </TableCell>
                    <TableCell className="text-sm text-fg">{k.dosenNama}</TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {k.jadwal ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                          {k.jadwal.hari}, {k.jadwal.jamMulai}–{k.jadwal.jamSelesai} · {k.jadwal.ruang}
                        </span>
                      ) : (
                        <span className="text-fg-subtle">Belum dijadwalkan</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Num className="text-fg">{k.jumlahMhs}</Num>
                      <span className="text-2xs text-fg-subtle">/{k.kapasitas}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditKelas(k)}>
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          Edit
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() => hapusKelas(k)}
                          loading={prosesId === `/api/manajemen/kelas/${k.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ── Dosen ───────────────────────────────────── */}
      <TabsContent value="dosen">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            {dosenList.filter((d) => d.status === "aktif").length} akun aktif dari {dosenList.length} total
            (dosen & kaprodi). Menonaktifkan akun juga mematikan akses login-nya.
          </p>
          <Dialog open={bukaDosen} onOpenChange={setBukaDosen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Tambah akun
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {fd.role === "kaprodi" ? "Tambah akun kaprodi" : "Tambah akun dosen"}
                </DialogTitle>
                <DialogDescription>
                  Kaprodi membuat akun login sekaligus profil. Kata sandi awal dapat
                  diubah pemilik akun setelah masuk.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  buatAkun(
                    "/api/manajemen/dosen",
                    {
                      role: fd.role,
                      nama: fd.nama,
                      nip: fd.nip,
                      email: fd.email,
                      password: fd.password,
                      gelar: fd.gelar,
                      bidangStudi: fd.bidangStudi,
                      semesterKe: fd.semesterKe === "" ? null : Number(fd.semesterKe),
                    },
                    setErrDosen,
                    setSimpanDosen,
                    () => {
                      setBukaDosen(false);
                      setFd({
                        role: "dosen",
                        nama: "",
                        nip: "",
                        email: "",
                        password: "",
                        gelar: "",
                        bidangStudi: "",
                        semesterKe: "",
                      });
                    }
                  );
                }}
                className="flex flex-col gap-3"
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Peran akun</span>
                  <Select
                    value={fd.role}
                    onChange={(e) =>
                      setFd({ ...fd, role: e.target.value as "dosen" | "kaprodi" })
                    }
                    options={[
                      { value: "dosen", label: "Dosen" },
                      { value: "kaprodi", label: "Kaprodi (operator prodi)" },
                    ]}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Nama lengkap</span>
                  <Input
                    value={fd.nama}
                    onChange={(e) => setFd({ ...fd, nama: e.target.value })}
                    placeholder="mis. Dr. Ahmad Fauzi"
                    maxLength={120}
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">NIP</span>
                    <Input
                      value={fd.nip}
                      onChange={(e) => setFd({ ...fd, nip: e.target.value })}
                      placeholder="mis. 198701012010011001"
                      maxLength={30}
                      mono
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Gelar (opsional)</span>
                    <Input
                      value={fd.gelar}
                      onChange={(e) => setFd({ ...fd, gelar: e.target.value })}
                      placeholder="mis. S.Pd., M.Pd."
                      maxLength={60}
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Bidang studi (opsional)</span>
                    <Input
                      value={fd.bidangStudi}
                      onChange={(e) => setFd({ ...fd, bidangStudi: e.target.value })}
                      placeholder="mis. Pendidikan Matematika"
                      maxLength={80}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">
                      Mengajar semester ke ({jenisAktif})
                    </span>
                    <Select
                      value={fd.semesterKe}
                      onChange={(e) => setFd({ ...fd, semesterKe: e.target.value })}
                      options={opsiSmtAktif}
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Email</span>
                    <Input
                      type="email"
                      value={fd.email}
                      onChange={(e) => setFd({ ...fd, email: e.target.value })}
                      placeholder="nama@wahidiyah.ac.id"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Kata sandi awal</span>
                    <Input
                      type="password"
                      value={fd.password}
                      onChange={(e) => setFd({ ...fd, password: e.target.value })}
                      placeholder="min. 6 karakter"
                      minLength={6}
                      required
                    />
                  </label>
                </div>
                {errDosen && (
                  <p className="flex items-start gap-1.5 text-sm text-danger-text">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    {errDosen}
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setBukaDosen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" loading={simpanDosen}>
                    Simpan akun
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {dosenList.length === 0 ? (
          <EmptyState compact judul="Belum ada dosen" deskripsi="Belum ada profil dosen di sistem." />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">NIP</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24 text-center">Smt</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-72 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dosenList.map((d) => {
                  const aktif = d.status === "aktif";
                  const diri = d.userId === userIdSaya;
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Num className="text-fg-muted">{d.nip}</Num>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-fg">{d.nama}</span>
                          <Badge variant={d.role === "kaprodi" ? "accent" : "neutral"}>
                            {d.role === "kaprodi" ? "Kaprodi" : "Dosen"}
                          </Badge>
                        </span>
                        {d.gelar && <span className="text-2xs text-fg-subtle">{d.gelar}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-fg-muted">{d.email}</TableCell>
                      <TableCell className="text-center text-xs text-fg-muted">
                        {d.semesterKe === null ? "—" : `Smt ${d.semesterKe}`}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={aktif ? "success" : "neutral"}>{d.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setEditDosen(d)}>
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                            Edit
                          </Button>
                          <Button
                            variant={aktif ? "danger-ghost" : "secondary"}
                            size="sm"
                            disabled={diri && aktif}
                            title={diri ? "Tidak dapat menonaktifkan akun sendiri" : undefined}
                            onClick={() =>
                              kirimPatch(
                                `/api/manajemen/dosen/${d.id}`,
                                { status: aktif ? "nonaktif" : "aktif" },
                                "Gagal mengubah status akun."
                              )
                            }
                            loading={prosesId === `/api/manajemen/dosen/${d.id}`}
                          >
                            <Power className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                            {aktif ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button
                            variant="danger-ghost"
                            size="sm"
                            disabled={diri}
                            title={diri ? "Tidak dapat menghapus akun sendiri" : undefined}
                            onClick={() =>
                              mintaHapus(
                                `/api/manajemen/dosen/${d.id}`,
                                `${d.nama} (${d.role})`
                              )
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                            Hapus
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ── Mahasiswa ───────────────────────────────── */}
      <TabsContent value="mahasiswa">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            {mahasiswaList.length} akun mahasiswa terdaftar. Kaprodi membuat akun login sekaligus profil mahasiswa.
          </p>
          <Dialog open={bukaMhs} onOpenChange={setBukaMhs}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Tambah mahasiswa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah akun mahasiswa</DialogTitle>
                <DialogDescription>
                  Isi identitas akademik mahasiswa. Kata sandi awal dapat diganti mahasiswa setelah masuk.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  buatAkun(
                    "/api/manajemen/mahasiswa",
                    {
                      nama: fm.nama,
                      nim: fm.nim,
                      angkatan: Number(fm.angkatan),
                      jenisKelamin: fm.jenisKelamin,
                      kelasMhs: fm.kelasMhs,
                      email: fm.email,
                      password: fm.password,
                      semesterKe: fm.semesterKe === "" ? null : Number(fm.semesterKe),
                    },
                    setErrMhs,
                    setSimpanMhs,
                    () => {
                      setBukaMhs(false);
                      setFm({
                        nama: "",
                        nim: "",
                        angkatan: String(new Date().getFullYear()),
                        jenisKelamin: "L",
                        kelasMhs: "",
                        email: "",
                        password: "",
                        semesterKe: "",
                      });
                    }
                  );
                }}
                className="flex flex-col gap-3"
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Nama lengkap</span>
                  <Input
                    value={fm.nama}
                    onChange={(e) => setFm({ ...fm, nama: e.target.value })}
                    placeholder="mis. Siti Rahmawati"
                    maxLength={120}
                    required
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">NIM</span>
                    <Input
                      value={fm.nim}
                      onChange={(e) => setFm({ ...fm, nim: e.target.value })}
                      placeholder="mis. 2023010001"
                      maxLength={30}
                      mono
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Angkatan</span>
                    <Input
                      type="number"
                      min={1990}
                      max={new Date().getFullYear() + 1}
                      value={fm.angkatan}
                      onChange={(e) => setFm({ ...fm, angkatan: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Jenis kelamin</span>
                    <Select
                      value={fm.jenisKelamin}
                      onChange={(e) => setFm({ ...fm, jenisKelamin: e.target.value })}
                      options={[
                        { value: "L", label: "Laki-laki" },
                        { value: "P", label: "Perempuan" },
                      ]}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Rombongan belajar</span>
                    <Input
                      value={fm.kelasMhs}
                      onChange={(e) => setFm({ ...fm, kelasMhs: e.target.value })}
                      placeholder={`mis. ${fm.angkatan}-A`}
                      maxLength={30}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">
                      Semester ke ({jenisAktif})
                    </span>
                    <Select
                      value={fm.semesterKe}
                      onChange={(e) => setFm({ ...fm, semesterKe: e.target.value })}
                      options={opsiSmtAktif}
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Email</span>
                    <Input
                      type="email"
                      value={fm.email}
                      onChange={(e) => setFm({ ...fm, email: e.target.value })}
                      placeholder="nama@wahidiyah.ac.id"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Kata sandi awal</span>
                    <Input
                      type="password"
                      value={fm.password}
                      onChange={(e) => setFm({ ...fm, password: e.target.value })}
                      placeholder="min. 6 karakter"
                      minLength={6}
                      required
                    />
                  </label>
                </div>
                {errMhs && (
                  <p className="flex items-start gap-1.5 text-sm text-danger-text">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    {errMhs}
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setBukaMhs(false)}>
                    Batal
                  </Button>
                  <Button type="submit" loading={simpanMhs}>
                    Simpan akun
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {mahasiswaList.length === 0 ? (
          <EmptyState compact judul="Belum ada mahasiswa" deskripsi="Belum ada akun mahasiswa di sistem." />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">NIM</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-24">Angkatan</TableHead>
                  <TableHead className="w-28">Rombel</TableHead>
                  <TableHead className="w-24 text-center">Smt</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                  <TableHead className="w-44 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mahasiswaList.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Num className="text-fg-muted">{m.nim}</Num>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-fg">{m.nama}</span>
                    </TableCell>
                    <TableCell>
                      <Num className="text-fg-muted">{m.angkatan}</Num>
                    </TableCell>
                    <TableCell className="text-fg-muted">{m.kelasMhs}</TableCell>
                    <TableCell className="text-center text-xs text-fg-muted">
                      {m.semesterKe === null ? "—" : `Smt ${m.semesterKe}`}
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">{m.email}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={m.status === "aktif" ? "success" : "neutral"}>{m.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditMhs(m)}>
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          Edit
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() =>
                            mintaHapus(
                              `/api/manajemen/mahasiswa/${m.id}`,
                              `${m.nama} (mahasiswa)`
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          Hapus
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ── Validasi KRS ─────────────────────────────── */}
      <TabsContent value="krs">
        <p className="mb-3 text-sm text-fg-muted">
          Setujui pengajuan KRS mahasiswa pada semester aktif. Menolak akan menghapus baris
          pengajuan sehingga mahasiswa dapat mengajukan ulang — keputusan tercatat di log audit.
        </p>
        {krsPengajuan.length === 0 ? (
          <EmptyState compact judul="Tidak ada pengajuan" deskripsi="Belum ada pengajuan KRS yang menunggu validasi." />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">NIM</TableHead>
                  <TableHead>Mahasiswa</TableHead>
                  <TableHead>Mata kuliah</TableHead>
                  <TableHead className="w-24">Kelas</TableHead>
                  <TableHead className="w-16 text-right">SKS</TableHead>
                  <TableHead className="w-36">Diajukan</TableHead>
                  <TableHead className="w-44 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {krsPengajuan.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Num className="text-fg-muted">{r.nim}</Num>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-fg">{r.mahasiswa}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block text-fg">{r.nama}</span>
                      <span className="text-2xs text-fg-subtle">{r.kode}</span>
                    </TableCell>
                    <TableCell className="text-fg-muted">{r.kodeKelas}</TableCell>
                    <TableCell className="text-right">
                      <Num className="text-fg-muted">{r.sks}</Num>
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {formatTanggal(r.diajukanPada)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            kirimPatch(
                              `/api/krs/${r.id}`,
                              { aksi: "terima" },
                              "Gagal menyetujui pengajuan."
                            )
                          }
                          loading={prosesId === `/api/krs/${r.id}`}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                          Terima
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          onClick={() =>
                            kirimPatch(
                              `/api/krs/${r.id}`,
                              { aksi: "tolak" },
                              "Gagal menolak pengajuan."
                            )
                          }
                          loading={prosesId === `/api/krs/${r.id}`}
                        >
                          Tolak
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      {/* ── Semester ────────────────────────────────── */}
      <TabsContent value="semester">
        <p className="mb-3 text-sm text-fg-muted">
          Hanya satu semester yang bisa aktif. Perpindahan semester menonaktifkan yang lain.
        </p>
        {semesterList.length === 0 ? (
          <EmptyState compact judul="Belum ada semester" deskripsi="Belum ada data semester di sistem." />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semester</TableHead>
                  <TableHead className="w-36">Mulai</TableHead>
                  <TableHead className="w-36">Selesai</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-32 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semesterList.map((s) => (
                  <TableRow key={s.id} className={s.isAktif ? "bg-surface-muted/40" : undefined}>
                    <TableCell>
                      <span className="font-medium text-fg">
                        {s.nama} {s.tahun}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {formatTanggal(s.tanggalMulai)}
                    </TableCell>
                    <TableCell className="text-xs text-fg-muted">
                      {formatTanggal(s.tanggalSelesai)}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.isAktif ? (
                        <Badge variant="success">
                          <Check className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!s.isAktif && (
                        <Button
                          size="sm"
                          onClick={() =>
                            kirimPatch(
                              `/api/manajemen/semester/${s.id}`,
                              {},
                              "Gagal menetapkan semester aktif."
                            )
                          }
                          loading={prosesId === `/api/manajemen/semester/${s.id}`}
                        >
                          Jadikan aktif
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>

      {editMK && (
        <DialogEditMK
          item={editMK}
          jenisSemester={jenisAktif}
          onClose={() => setEditMK(null)}
          onSaved={() => {
            setEditMK(null);
            router.refresh();
          }}
        />
      )}
      {editDosen && (
        <DialogEditDosen
          item={editDosen}
          jenisSemester={jenisAktif}
          onClose={() => setEditDosen(null)}
          onSaved={() => {
            setEditDosen(null);
            router.refresh();
          }}
        />
      )}
      {editMhs && (
        <DialogEditMahasiswa
          item={editMhs}
          jenisSemester={jenisAktif}
          onClose={() => setEditMhs(null)}
          onSaved={() => {
            setEditMhs(null);
            router.refresh();
          }}
        />
      )}
      {(bukaKelas || editKelas) && (
        <DialogKelas
          item={editKelas}
          mkList={mkList}
          semesterList={semesterList}
          dosenList={dosenList}
          onClose={() => {
            setBukaKelas(false);
            setEditKelas(null);
          }}
          onSaved={() => {
            setBukaKelas(false);
            setEditKelas(null);
            router.refresh();
          }}
        />
      )}

      <DialogKonfirmasiHapus
        open={hapusTarget !== null}
        onOpenChange={(v) => {
          if (!v) {
            setHapusTarget(null);
            setHapusGalat(null);
          }
        }}
        label={hapusTarget?.label ?? ""}
        rincian={hapusRincian}
        total={hapusTotal}
        loading={hapusLoading}
        memproses={hapusProses}
        galat={hapusGalat}
        onKonfirmasi={konfirmasiHapus}
      />
    </>
  );
}

/** Galat form ringkas dengan ikon. */
function PesanGalat({ pesan }: { pesan: string | null }) {
  if (!pesan) return null;
  return (
    <p className="flex items-start gap-1.5 text-sm text-danger-text">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
      {pesan}
    </p>
  );
}

function DialogEditMK({
  item,
  jenisSemester,
  onClose,
  onSaved,
}: {
  item: ItemMK;
  jenisSemester: JenisSemester;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kode, setKode] = React.useState(item.kode);
  const [nama, setNama] = React.useState(item.nama);
  const [sks, setSks] = React.useState(String(item.sks));
  const [kategori, setKategori] = React.useState<"wajib" | "pilihan">(item.kategori);
  const [smt, setSmt] = React.useState(item.semesterKe === null ? "" : String(item.semesterKe));
  const [error, setError] = React.useState<string | null>(null);
  const [simpan, setSimpan] = React.useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSimpan(true);
    const hasil = await kirimJson("PATCH", `/api/manajemen/mk/${item.id}`, {
      kode,
      nama,
      sks: Number(sks),
      kategori,
      semesterKe: smt === "" ? null : Number(smt),
    });
    setSimpan(false);
    if (!hasil.ok) {
      setError(hasil.error ?? "Gagal menyimpan mata kuliah.");
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit mata kuliah</DialogTitle>
          <DialogDescription>
            Perbaiki data mata kuliah bila ada kekeliruan. Perubahan berlaku pada kelas terkait.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={kirim} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-fg-muted">Kode</span>
              <Input
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                maxLength={12}
                mono
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">SKS</span>
              <Input
                type="number"
                min={1}
                max={6}
                value={sks}
                onChange={(e) => setSks(e.target.value)}
                required
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Nama mata kuliah</span>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={120}
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Kategori</span>
              <Select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as "wajib" | "pilihan")}
                options={[
                  { value: "wajib", label: "Wajib" },
                  { value: "pilihan", label: "Pilihan" },
                ]}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">
                Semester ke ({jenisSemester})
              </span>
              <Select
                value={smt}
                onChange={(e) => setSmt(e.target.value)}
                options={[
                  { value: "", label: "Belum dipetakan" },
                  ...opsiSelectSemesterKe(jenisSemester),
                ]}
              />
            </label>
          </div>
          <PesanGalat pesan={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" loading={simpan}>
              Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogEditDosen({
  item,
  jenisSemester,
  onClose,
  onSaved,
}: {
  item: ItemDosen;
  jenisSemester: JenisSemester;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nama, setNama] = React.useState(item.nama);
  const [nip, setNip] = React.useState(item.nip);
  const [gelar, setGelar] = React.useState(item.gelar ?? "");
  const [bidang, setBidang] = React.useState(item.bidang ?? "");
  const [email, setEmail] = React.useState(item.email);
  const [smt, setSmt] = React.useState(item.semesterKe === null ? "" : String(item.semesterKe));
  const [error, setError] = React.useState<string | null>(null);
  const [simpan, setSimpan] = React.useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSimpan(true);
    const hasil = await kirimJson("PATCH", `/api/manajemen/dosen/${item.id}`, {
      nama,
      nip,
      gelar,
      bidangStudi: bidang,
      email,
      semesterKe: smt === "" ? null : Number(smt),
    });
    setSimpan(false);
    if (!hasil.ok) {
      setError(hasil.error ?? "Gagal menyimpan profil.");
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profil {item.role === "kaprodi" ? "kaprodi" : "dosen"}</DialogTitle>
          <DialogDescription>
            Perbaiki identitas dosen bila ada kekeliruan data yang dilaporkan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={kirim} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Nama lengkap</span>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">NIP</span>
              <Input value={nip} onChange={(e) => setNip(e.target.value)} maxLength={30} mono required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Gelar (opsional)</span>
              <Input value={gelar} onChange={(e) => setGelar(e.target.value)} maxLength={60} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Bidang studi (opsional)</span>
              <Input value={bidang} onChange={(e) => setBidang(e.target.value)} maxLength={80} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">
                Mengajar semester ke ({jenisSemester})
              </span>
              <Select
                value={smt}
                onChange={(e) => setSmt(e.target.value)}
                options={[
                  { value: "", label: "Belum dipetakan" },
                  ...opsiSelectSemesterKe(jenisSemester),
                ]}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <PesanGalat pesan={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" loading={simpan}>
              Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogEditMahasiswa({
  item,
  jenisSemester,
  onClose,
  onSaved,
}: {
  item: ItemMahasiswa;
  jenisSemester: JenisSemester;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nama, setNama] = React.useState(item.nama);
  const [nim, setNim] = React.useState(item.nim);
  const [angkatan, setAngkatan] = React.useState(String(item.angkatan));
  const [jenisKelamin, setJenisKelamin] = React.useState(item.jenisKelamin);
  const [kelasMhs, setKelasMhs] = React.useState(item.kelasMhs);
  const [email, setEmail] = React.useState(item.email);
  const [smt, setSmt] = React.useState(item.semesterKe === null ? "" : String(item.semesterKe));
  const [error, setError] = React.useState<string | null>(null);
  const [simpan, setSimpan] = React.useState(false);

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSimpan(true);
    const hasil = await kirimJson("PATCH", `/api/manajemen/mahasiswa/${item.id}`, {
      nama,
      nim,
      angkatan: Number(angkatan),
      jenisKelamin,
      kelasMhs,
      email,
      semesterKe: smt === "" ? null : Number(smt),
    });
    setSimpan(false);
    if (!hasil.ok) {
      setError(hasil.error ?? "Gagal menyimpan profil.");
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profil mahasiswa</DialogTitle>
          <DialogDescription>
            Perbaiki identitas mahasiswa bila ada kekeliruan data yang dilaporkan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={kirim} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Nama lengkap</span>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">NIM</span>
              <Input value={nim} onChange={(e) => setNim(e.target.value)} maxLength={30} mono required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Angkatan</span>
              <Input
                type="number"
                min={1990}
                max={new Date().getFullYear() + 1}
                value={angkatan}
                onChange={(e) => setAngkatan(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Jenis kelamin</span>
              <Select
                value={jenisKelamin}
                onChange={(e) => setJenisKelamin(e.target.value)}
                options={[
                  { value: "L", label: "Laki-laki" },
                  { value: "P", label: "Perempuan" },
                ]}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Rombongan belajar</span>
              <Input
                value={kelasMhs}
                onChange={(e) => setKelasMhs(e.target.value)}
                maxLength={30}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">
                Semester ke ({jenisSemester})
              </span>
              <Select
                value={smt}
                onChange={(e) => setSmt(e.target.value)}
                options={[
                  { value: "", label: "Belum dipetakan" },
                  ...opsiSelectSemesterKe(jenisSemester),
                ]}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">Email</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <PesanGalat pesan={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" loading={simpan}>
              Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const HARI_OPSI = [
  { value: "Senin", label: "Senin" },
  { value: "Selasa", label: "Selasa" },
  { value: "Rabu", label: "Rabu" },
  { value: "Kamis", label: "Kamis" },
  { value: "Jumat", label: "Jumat" },
  { value: "Sabtu", label: "Sabtu" },
];

function DialogKelas({
  item,
  mkList,
  semesterList,
  dosenList,
  onClose,
  onSaved,
}: {
  item: ItemKelas | null;
  mkList: ItemMK[];
  semesterList: ItemSemester[];
  dosenList: ItemDosen[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const modeEdit = item !== null;
  const mkAktif = mkList.filter((m) => m.aktif);
  const semesterDefault = semesterList.find((s) => s.isAktif)?.id ?? semesterList[0]?.id ?? "";

  const [mkId, setMkId] = React.useState(item?.mkId ?? mkAktif[0]?.id ?? "");
  const [semesterId, setSemesterId] = React.useState(item?.semesterId ?? semesterDefault);
  const [dosenId, setDosenId] = React.useState(item?.dosenId ?? dosenList[0]?.id ?? "");
  const [kodeKelas, setKodeKelas] = React.useState(item?.kodeKelas ?? "A");
  const [kapasitas, setKapasitas] = React.useState(String(item?.kapasitas ?? 40));
  const [pakaiJadwal, setPakaiJadwal] = React.useState(item?.jadwal !== null && item !== null);
  const [hari, setHari] = React.useState(item?.jadwal?.hari ?? "Senin");
  const [jamMulai, setJamMulai] = React.useState(item?.jadwal?.jamMulai ?? "08:00");
  const [jamSelesai, setJamSelesai] = React.useState(item?.jadwal?.jamSelesai ?? "09:40");
  const [ruang, setRuang] = React.useState(item?.jadwal?.ruang ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [simpan, setSimpan] = React.useState(false);

  // Paritas semester tujuan menentukan pengurutan MK & penyaringan dosen.
  const jenisTerpilih = (semesterList.find((s) => s.id === semesterId)?.nama ??
    "Ganjil") as JenisSemester;
  const mkTerurut = [...mkAktif].sort((a, b) => {
    const aCocok =
      a.semesterKe !== null && cocokParitas(a.semesterKe, jenisTerpilih) ? 0 : 1;
    const bCocok =
      b.semesterKe !== null && cocokParitas(b.semesterKe, jenisTerpilih) ? 0 : 1;
    if (aCocok !== bCocok) return aCocok - bCocok;
    return a.kode.localeCompare(b.kode);
  });
  const dosenAktif = dosenList.filter((d) => d.status === "aktif");
  const dosenCocok = dosenAktif.filter(
    (d) => d.semesterKe === null || cocokParitas(d.semesterKe, jenisTerpilih)
  );
  const dosenDasar = dosenCocok.length > 0 ? dosenCocok : dosenAktif;
  const dosenOpsi = (() => {
    if (dosenId && !dosenDasar.some((d) => d.id === dosenId)) {
      const terpilih = dosenAktif.find((d) => d.id === dosenId);
      if (terpilih) return [terpilih, ...dosenDasar];
    }
    return dosenDasar;
  })();

  async function kirim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSimpan(true);
    const jadwal = pakaiJadwal ? { hari, jamMulai, jamSelesai, ruang } : null;
    const hasil = modeEdit
      ? await kirimJson("PATCH", `/api/manajemen/kelas/${item.id}`, {
          dosenId,
          kodeKelas,
          kapasitas: Number(kapasitas),
          jadwal,
        })
      : await kirimJson("POST", "/api/manajemen/kelas", {
          mkId,
          semesterId,
          dosenId,
          kodeKelas,
          kapasitas: Number(kapasitas),
          jadwal: jadwal ?? undefined,
        });
    setSimpan(false);
    if (!hasil.ok) {
      setError(hasil.error ?? "Gagal menyimpan kelas.");
      return;
    }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modeEdit ? "Edit kelas" : "Buat kelas"}</DialogTitle>
          <DialogDescription>
            {modeEdit
              ? "Ganti dosen pengampu, kode kelas, kapasitas, atau jadwal kelas."
              : "Kaitkan satu mata kuliah dengan dosen pengampu pada semester tertentu."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={kirim} className="flex flex-col gap-3">
          {modeEdit && item ? (
            <div className="grid gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-2xs font-medium uppercase tracking-wide text-fg-subtle">
                  Mata kuliah
                </span>
                <span className="text-sm font-medium text-fg">
                  {item.mkKode} — {item.mkNama}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-2xs font-medium uppercase tracking-wide text-fg-subtle">
                  Semester
                </span>
                <span className="text-sm font-medium text-fg">{item.semesterLabel}</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">
                  Mata kuliah{" "}
                  <span className="font-normal text-fg-subtle">
                    (paritas {jenisTerpilih} diurut di atas)
                  </span>
                </span>
                <Select
                  value={mkId}
                  onChange={(e) => setMkId(e.target.value)}
                  options={mkTerurut.map((m) => ({
                    value: m.id,
                    label:
                      `${m.kode} — ${m.nama}` +
                      (m.semesterKe === null ? "" : ` · Smt ${m.semesterKe}`) +
                      (m.semesterKe !== null && !cocokParitas(m.semesterKe, jenisTerpilih)
                        ? " · beda semester"
                        : ""),
                  }))}
                  disabled={mkAktif.length === 0}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Semester</span>
                <Select
                  value={semesterId}
                  onChange={(e) => setSemesterId(e.target.value)}
                  options={semesterList.map((s) => ({
                    value: s.id,
                    label: `${s.nama} ${s.tahun}${s.isAktif ? " (aktif)" : ""}`,
                  }))}
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-fg-muted">
              Dosen pengampu{" "}
              <span className="font-normal text-fg-subtle">
                (disaring paritas {jenisTerpilih})
              </span>
            </span>
            <Select
              value={dosenId}
              onChange={(e) => setDosenId(e.target.value)}
              options={dosenOpsi.map((d) => ({
                value: d.id,
                label:
                  `${d.nama}${d.role === "kaprodi" ? " (kaprodi)" : ""}` +
                  (d.semesterKe === null ? "" : ` · Smt ${d.semesterKe}`),
              }))}
              disabled={dosenAktif.length === 0}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Kode kelas</span>
              <Input
                value={kodeKelas}
                onChange={(e) => setKodeKelas(e.target.value.toUpperCase())}
                placeholder="mis. A"
                maxLength={10}
                mono
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-fg-muted">Kapasitas</span>
              <Input
                type="number"
                min={1}
                max={200}
                value={kapasitas}
                onChange={(e) => setKapasitas(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border text-accent focus-visible:ring-2 focus-visible:ring-accent/30"
              checked={pakaiJadwal}
              onChange={(e) => setPakaiJadwal(e.target.checked)}
            />
            <span className="text-sm text-fg">Sertakan jadwal kelas</span>
          </label>

          {pakaiJadwal && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Hari</span>
                <Select
                  value={hari}
                  onChange={(e) => setHari(e.target.value)}
                  options={HARI_OPSI}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Ruang</span>
                <Input
                  value={ruang}
                  onChange={(e) => setRuang(e.target.value)}
                  placeholder="mis. Ruang B.201"
                  maxLength={40}
                  required={pakaiJadwal}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Jam mulai</span>
                <Input
                  type="time"
                  value={jamMulai}
                  onChange={(e) => setJamMulai(e.target.value)}
                  required={pakaiJadwal}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-fg-muted">Jam selesai</span>
                <Input
                  type="time"
                  value={jamSelesai}
                  onChange={(e) => setJamSelesai(e.target.value)}
                  required={pakaiJadwal}
                />
              </label>
            </div>
          )}

          {!modeEdit && mkAktif.length === 0 && (
            <PesanGalat pesan="Belum ada mata kuliah aktif. Tambah mata kuliah terlebih dahulu." />
          )}
          {dosenAktif.length === 0 && (
            <PesanGalat pesan="Belum ada dosen aktif yang dapat ditugaskan." />
          )}
          <PesanGalat pesan={error} />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              loading={simpan}
              disabled={
                (!modeEdit && mkAktif.length === 0) ||
                dosenAktif.length === 0
              }
            >
              {modeEdit ? "Simpan perubahan" : "Buat kelas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}