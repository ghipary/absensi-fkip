"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/form-extras";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/states";
import { SkeletonTabel, Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Num,
} from "@/components/ui/table";
import {
  QrCode,
  Copy,
  CheckCircle2,
  Timer,
  MapPin,
  UserPlus,
  RefreshCw,
  Plus,
  CalendarPlus,
} from "lucide-react";

type KelasDTO = {
  id: string;
  kode: string;
  nama: string;
  kodeKelas: string;
  jumlahMhs: number;
  jadwal: { hari: string; jam: string; ruang: string }[];
  pertemuan: {
    id: string;
    nomor: number;
    tanggal: string;
    jumlahAbsen: number;
    sesiTerbuka: boolean;
  }[];
};

type SesiAktif = {
  id: string;
  kodeUnik: string;
  qrUrl: string;
  expiresAt: string;
  metode: "qr" | "kode";
  lokasiWajib: boolean;
};

type HadirDTO = {
  id: string;
  nim: string;
  nama: string;
  status: string;
  metode: string;
  checkInAt: string;
};

/**
 * Panel inti dosen: pilih kelas & pertemuan → buka sesi →
 * QR + kode unik + countdown → daftar hadir real-time → absen manual.
 */
export function PanelSesi({
  daftarKelas,
  kelasIdAwal,
  pertemuanIdAwal,
  namaDosen,
}: {
  daftarKelas: KelasDTO[];
  kelasIdAwal: string;
  pertemuanIdAwal: string | null;
  namaDosen: string;
}) {
  const router = useRouter();
  const [kelasId, setKelasId] = useState(kelasIdAwal);
  const [pertemuanId, setPertemuanId] = useState(pertemuanIdAwal);
  const [menit, setMenit] = useState(10);
  const [lokasiWajib, setLokasiWajib] = useState(false);
  const [membuka, setMembuka] = useState(false);
  const [menutup, setMenutup] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [tambahOpen, setTambahOpen] = useState(false);
  const [sesi, setSesi] = useState<SesiAktif | null>(null);
  const [sisaDetik, setSisaDetik] = useState(0);
  const [tersalin, setTersalin] = useState(false);

  const kelas = daftarKelas.find((k) => k.id === kelasId) ?? daftarKelas[0];
  const pertemuan = kelas?.pertemuan.find((p) => p.id === pertemuanId);

  // Sesi aktif dari server (bila user reload / buka dari halaman lain)
  const { data: dataSesi, refetch: refetchSesi } = useQuery({
    queryKey: ["sesi-aktif", kelasId],
    queryFn: async () => {
      const res = await fetch(`/api/absensi/status?kelasId=${kelasId}`);
      if (!res.ok) return null;
      return (await res.json()) as { sesi: SesiAktif | null };
    },
    enabled: !!kelasId,
    refetchInterval: sesi ? false : 15_000,
  });

  useEffect(() => {
    if (dataSesi?.sesi && !sesi) setSesi(dataSesi.sesi);
  }, [dataSesi, sesi]);

  // Countdown
  useEffect(() => {
    if (!sesi) return;
    const hitung = () => {
      const s = Math.max(
        0,
        Math.floor((new Date(sesi.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSisaDetik(s);
      if (s === 0) {
        setSesi(null);
        toast.info("Masa berlaku sesi habis. Buka sesi baru bila perlu.");
      }
    };
    hitung();
    const t = setInterval(hitung, 1000);
    return () => clearInterval(t);
  }, [sesi]);

  // Daftar hadir — polling 3 detik selama sesi terbuka
  const { data: hadir, refetch: refetchHadir } = useQuery({
    queryKey: ["hadir", sesi?.id],
    queryFn: async () => {
      const res = await fetch(`/api/absensi/hadir?sesiId=${sesi!.id}`);
      if (!res.ok) return [] as HadirDTO[];
      return (await res.json()).daftar as HadirDTO[];
    },
    enabled: !!sesi,
    refetchInterval: sesi ? 3_000 : false,
  });

  // SSE: langsung segarkan saat ada check-in masuk
  useEffect(() => {
    if (!sesi) return;
    const es = new EventSource("/api/events");
    es.addEventListener("notifikasi", () => {
      refetchHadir();
    });
    return () => es.close();
  }, [sesi, refetchHadir]);

  async function bukaSesi() {
    if (!pertemuan) return;
    setMembuka(true);
    try {
      const res = await fetch("/api/absensi/sesi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pertemuanId: pertemuan.id,
          metode: "qr",
          menitBerlaku: menit,
          lokasiWajib,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal membuka sesi.");
        return;
      }
      setSesi(data.sesi);
      toast.success(`Sesi absensi terbuka — ${menit} menit`, {
        description: `Pertemuan ke-${pertemuan.nomor} · ${kelas?.nama}`,
      });
      refetchHadir();
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setMembuka(false);
    }
  }

  async function tutupSesi() {
    if (!sesi) return;
    setMenutup(true);
    try {
      const res = await fetch(`/api/absensi/sesi?id=${sesi.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSesi(null);
        toast.success("Sesi absensi ditutup.");
        refetchSesi();
        router.refresh();
      } else {
        toast.error("Gagal menutup sesi.");
      }
    } finally {
      setMenutup(false);
    }
  }

  async function salinKode() {
    if (!sesi) return;
    try {
      await navigator.clipboard.writeText(sesi.kodeUnik);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 1500);
    } catch {
      toast.error("Gagal menyalin. Kode: " + sesi.kodeUnik);
    }
  }

  const mm = String(Math.floor(sisaDetik / 60)).padStart(2, "0");
  const ss = String(sisaDetik % 60).padStart(2, "0");

  if (!kelas) return null;

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Buka sesi absensi</CardTitle>
            <p className="text-xs text-fg-muted">
              Pengampu: {namaDosen} · {kelas.jumlahMhs} mahasiswa terdaftar
            </p>
          </div>
          {sesi && (
            <Badge variant="success">
              <StatusDot tone="success" />
              Sesi aktif
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {/* Pilihan kelas & pertemuan */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pilih-kelas">Mata kuliah</Label>
              <Select
                id="pilih-kelas"
                value={kelasId}
                onChange={(e) => {
                  setKelasId(e.target.value);
                  setSesi(null);
                  const k = daftarKelas.find((x) => x.id === e.target.value);
                  setPertemuanId(
                    k?.pertemuan.find((p) => p.sesiTerbuka)?.id ??
                      k?.pertemuan.find((p) => p.jumlahAbsen === 0)?.id ??
                      k?.pertemuan[k.pertemuan.length - 1]?.id ??
                      null
                  );
                }}
                options={daftarKelas.map((k) => ({
                  value: k.id,
                  label: `${k.kode} — ${k.nama} (${k.kodeKelas})`,
                }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pilih-pertemuan">Pertemuan</Label>
                <button
                  type="button"
                  onClick={() => setTambahOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <Plus className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Tambah pertemuan
                </button>
              </div>
              <Select
                id="pilih-pertemuan"
                value={pertemuanId ?? ""}
                onChange={(e) => setPertemuanId(e.target.value)}
                placeholder="Pilih pertemuan"
                options={kelas.pertemuan.map((p) => ({
                  value: p.id,
                  label: `Ke-${p.nomor} · ${format(new Date(p.tanggal), "d MMM yyyy", { locale: localeId })}${
                    p.jumlahAbsen > 0 ? ` · ${p.jumlahAbsen} hadir` : ""
                  }`,
                }))}
              />
            </div>
          </div>

          {/* Pengaturan sesi */}
          {!sesi && (
            <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-border pt-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="menit">Masa berlaku (menit)</Label>
                <Select
                  id="menit"
                  value={String(menit)}
                  onChange={(e) => setMenit(Number(e.target.value))}
                  options={[1, 5, 10, 15, 30, 60].map((m) => ({
                    value: String(m),
                    label: `${m} menit`,
                  }))}
                  className="w-32"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={lokasiWajib}
                  onChange={(e) => setLokasiWajib(e.target.checked)}
                  className="h-4 w-4 cursor-pointer appearance-none rounded border border-border-strong bg-surface checked:border-accent checked:bg-accent [&:checked]:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%2220 6 9 17 4 12%22/></svg>')] [&:checked]:bg-[length:12px] [&:checked]:bg-center [&:checked]:bg-no-repeat focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                />
                <MapPin className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                Wajibkan lokasi kelas
              </label>
              <Button
                onClick={bukaSesi}
                loading={membuka}
                disabled={!pertemuan}
                className="ml-auto"
              >
                <QrCode className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                {sesi ? "Perpanjang sesi" : "Buka sesi absensi"}
              </Button>
            </div>
          )}
          {!sesi && !pertemuan && (
            <p className="mt-3 text-xs text-warning-text">
              Pilih nomor pertemuan terlebih dahulu.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tampilan sesi aktif: QR + kode + countdown */}
      {sesi && (
        <Card className="mt-4 border-accent-border">
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-accent" strokeWidth={1.5} aria-hidden />
              <CardTitle>Sedang berlangsung</CardTitle>
            </div>
            <span
              className={`font-mono-nums text-lg font-semibold tabular-nums ${
                sisaDetik < 60 ? "text-danger-text" : "text-fg"
              }`}
              aria-label={`Sisa waktu ${mm} menit ${ss} detik`}
            >
              {mm}:{ss}
            </span>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* QR */}
              <div className="flex flex-col items-center rounded-lg border border-border bg-surface p-5">
                <div className="rounded-lg border border-border bg-white p-3">
                  <QRCodeCanvas
                    value={sesi.qrUrl}
                    size={184}
                    level="M"
                    includeMargin={false}
                    imageSettings={{
                      src: "",
                      height: 0,
                      width: 0,
                      excavate: false,
                    }}
                  />
                </div>
                <p className="mt-3 text-center text-xs text-fg-muted">
                  Pindai dengan kamera ponsel mahasiswa
                </p>
                <p className="mt-0.5 font-mono-nums text-2xs text-fg-subtle">
                  {kelas.kode} · Pertemuan{" "}
                  {kelas.pertemuan.find((p) => p.id === pertemuanId)?.nomor ?? "—"}
                </p>
              </div>

              {/* Kode unik + info */}
              <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                  <p className="text-xs font-medium text-fg-muted">
                    Kode unik (fallback manual)
                  </p>
                  <p className="mt-1 font-mono-nums text-3xl font-semibold tracking-[0.3em] text-fg">
                    {sesi.kodeUnik}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={salinKode}
                  >
                    {tersalin ? (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                    )}
                    {tersalin ? "Tersalin" : "Salin kode"}
                  </Button>
                </div>

                <div className="flex items-start gap-2 rounded border border-border px-3 py-2.5 text-xs text-fg-muted">
                  <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" strokeWidth={1.5} aria-hidden />
                  <span>
                    Berlaku sampai{" "}
                    <span className="font-mono-nums text-fg">
                      {format(new Date(sesi.expiresAt), "HH:mm", { locale: localeId })}
                    </span>{" "}
                    WIB
                    {sesi.lokasiWajib && " · lokasi diwajibkan"}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setManualOpen(true)}
                    className="flex-1"
                  >
                    <UserPlus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                    Absen manual
                  </Button>
                  <Button
                    variant="danger"
                    onClick={tutupSesi}
                    loading={menutup}
                    className="flex-1"
                  >
                    Tutup sesi
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daftar hadir live */}
      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Daftar hadir</CardTitle>
            <p className="text-xs text-fg-muted">
              {sesi
                ? "Diperbarui otomatis setiap check-in masuk"
                : "Buka sesi untuk mulai mencatat"}
            </p>
          </div>
          {sesi && (
            <Button variant="ghost" size="icon-sm" onClick={() => refetchHadir()} aria-label="Segarkan daftar">
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!sesi ? (
            <EmptyState
              compact
              icon={QrCode}
              judul="Belum ada sesi aktif"
              deskripsi="Check-in mahasiswa akan tampil di sini secara real-time setelah sesi dibuka."
            />
          ) : !hadir ? (
            <SkeletonTabel baris={4} kolom={4} />
          ) : hadir.length === 0 ? (
            <EmptyState
              compact
              judul="Belum ada yang absen"
              deskripsi="Menunggu mahasiswa memindai QR atau memasukkan kode unik."
            />
          ) : (
            <div className="overflow-hidden rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead>NIM</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead className="text-right">Jam</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hadir.map((h, i) => (
                    <TableRow key={h.id}>
                      <Num className="text-fg-subtle">{i + 1}</Num>
                      <TableCell className="font-mono-nums text-xs text-fg-muted">
                        {h.nim}
                      </TableCell>
                      <TableCell className="font-medium text-fg">
                        {h.nama}
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral">
                          {h.metode === "qr" ? "QR" : h.metode === "kode" ? "Kode" : h.metode}
                        </Badge>
                      </TableCell>
                      <Num className="text-fg-muted">
                        {format(new Date(h.checkInAt), "HH:mm", { locale: localeId })}
                      </Num>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Absen manual */}
      <DialogManual
        open={manualOpen}
        onOpenChange={setManualOpen}
        kelasId={kelasId}
        pertemuanId={pertemuanId}
        selesai={() => {
          setManualOpen(false);
          refetchHadir();
          router.refresh();
        }}
      />

      {/* Tambah pertemuan */}
      <DialogTambahPertemuan
        open={tambahOpen}
        onOpenChange={setTambahOpen}
        kelasId={kelasId}
        nomorBerikut={kelas.pertemuan.length + 1}
        selesai={(id) => {
          setTambahOpen(false);
          if (id) setPertemuanId(id);
          router.refresh();
        }}
      />
    </>
  );
}

/** Dialog absen manual: cari mahasiswa, set hadir/sakit/izin (override) */
function DialogManual({
  open,
  onOpenChange,
  kelasId,
  pertemuanId,
  selesai,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kelasId: string;
  pertemuanId: string | null;
  selesai: () => void;
}) {
  const [cari, setCari] = useState("");
  const [pilihan, setPilihan] = useState<string | null>(null);
  const [status, setStatus] = useState("hadir");
  const [simpan, setSimpan] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["cari-mahasiswa", kelasId, cari],
    queryFn: async () => {
      const res = await fetch(
        `/api/absensi/manual?kelasId=${kelasId}&q=${encodeURIComponent(cari)}`
      );
      if (!res.ok) return [];
      return (await res.json()).daftar as {
        id: string;
        nim: string;
        nama: string;
        sudahAbsen: boolean;
        status?: string;
      }[];
    },
    enabled: open && !!kelasId,
    refetchOnWindowFocus: false,
  });

  async function simpanManual() {
    if (!pilihan || !pertemuanId) return;
    setSimpan(true);
    try {
      const res = await fetch("/api/absensi/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pertemuanId,
          mahasiswaId: pilihan,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan absen manual.");
        return;
      }
      toast.success("Absen manual tersimpan.", {
        description: `Status: ${status}`,
      });
      setPilihan(null);
      setCari("");
      selesai();
    } finally {
      setSimpan(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Absen manual mahasiswa</DialogTitle>
          <DialogDescription>
            Untuk mahasiswa yang izin, sakit, atau terlambat menghubungi dosen.
            Semua perubahan tercatat di log audit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="Cari NIM atau nama mahasiswa..."
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            aria-label="Cari mahasiswa"
          />

          <div className="max-h-56 overflow-y-auto rounded border border-border">
            {!data || isFetching ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ) : data.length === 0 ? (
              <p className="p-4 text-center text-sm text-fg-muted">
                Tidak ada mahasiswa yang cocok.
              </p>
            ) : (
              data.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPilihan(m.id)}
                  className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-0 ${
                    pilihan === m.id
                      ? "bg-accent-subtle"
                      : "hover:bg-surface-muted"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-fg">
                      {m.nama}
                    </span>
                    <span className="font-mono-nums text-xs text-fg-muted">
                      {m.nim}
                    </span>
                  </span>
                  {m.sudahAbsen && (
                    <Badge variant="neutral">sudah: {m.status}</Badge>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status-manual">Status kehadiran</Label>
            <Select
              id="status-manual"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "hadir", label: "Hadir" },
                { value: "sakit", label: "Sakit" },
                { value: "izin", label: "Izin" },
                { value: "alpha", label: "Alpha" },
              ]}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={simpanManual}
            loading={simpan}
            disabled={!pilihan || !pertemuanId}
          >
            Simpan absen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog dosen menambah pertemuan baru pada kelas yang dipilih. */
function DialogTambahPertemuan({
  open,
  onOpenChange,
  kelasId,
  nomorBerikut,
  selesai,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kelasId: string;
  nomorBerikut: number;
  selesai: (id: string | null) => void;
}) {
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [topik, setTopik] = useState("");
  const [simpan, setSimpan] = useState(false);

  async function simpanPertemuan() {
    setSimpan(true);
    try {
      const res = await fetch("/api/pertemuan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kelasId, tanggal, topik }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menambah pertemuan.");
        return;
      }
      toast.success(`Pertemuan ke-${data.pertemuan.nomor} ditambahkan.`, {
        description: format(new Date(data.pertemuan.tanggal), "d MMMM yyyy", { locale: localeId }),
      });
      setTopik("");
      setTanggal(new Date().toISOString().slice(0, 10));
      selesai(data.pertemuan.id);
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setSimpan(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah pertemuan</DialogTitle>
          <DialogDescription>
            Pertemuan akan dibuat sebagai pertemuan ke-{nomorBerikut}. Nomor diurut otomatis
            di akhir daftar pertemuan kelas ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tanggal-pertemuan">Tanggal</Label>
            <Input
              id="tanggal-pertemuan"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topik-pertemuan">Topik (opsional)</Label>
            <Input
              id="topik-pertemuan"
              value={topik}
              onChange={(e) => setTopik(e.target.value)}
              placeholder="mis. Limit fungsi dan kekontinuan"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={simpanPertemuan} loading={simpan} disabled={!tanggal}>
            <CalendarPlus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Simpan pertemuan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
